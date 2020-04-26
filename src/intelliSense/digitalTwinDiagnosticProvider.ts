// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as parser from "jsonc-parser";
import * as vscode from "vscode";
import { DiagnosticMessage, DigitalTwinConstants } from "./digitalTwinConstants";
import { ClassNode, Literal, PropertyNode } from "./digitalTwinGraph";
import { IntelliSenseUtility, JsonNodeType, ModelContent, PropertyPair } from "./intelliSenseUtility";
import { LANGUAGE_CODE } from "./languageCode";

/**
 * Diagnostic problem
 */
interface Problem {
  offset: number;
  length: number;
  message: string;
}

/**
 * Diagnostic provider for DigitalTwin IntelliSense
 */
export class DigitalTwinDiagnosticProvider {
  /**
   * get property pair of name property
   * @param jsonNode json node
   */
  private static getNamePropertyPair(jsonNode: parser.Node): PropertyPair | undefined {
    if (jsonNode.type !== JsonNodeType.Object || !jsonNode.children || jsonNode.children.length === 0) {
      return undefined;
    }
    let propertyPair: PropertyPair | undefined;
    for (const child of jsonNode.children) {
      propertyPair = IntelliSenseUtility.parseProperty(child);
      if (!propertyPair) {
        continue;
      }
      if (propertyPair.name.value === DigitalTwinConstants.NAME) {
        return propertyPair;
      }
    }
    return undefined;
  }

  /**
   * add problem of invalid type
   * @param jsonNode json node
   * @param problems problem collection
   * @param validTypes valid type collection
   */
  private static addProblemOfInvalidType(jsonNode: parser.Node, problems: Problem[], validTypes: string[]): void {
    validTypes.unshift(DiagnosticMessage.InvalidType);
    const message: string = validTypes.join(DigitalTwinConstants.LINE_FEED);
    DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, message);
  }

  /**
   * add problem of unexpected property
   * @param jsonNode json node
   * @param problems problem collection
   */
  private static addProblemOfUnexpectedProperty(jsonNode: parser.Node, problems: Problem[]): void {
    const message: string = `${jsonNode.value as string} ${DiagnosticMessage.UnexpectedProperty}`;
    DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, message);
  }

  /**
   * add problem of diagnostic message
   * @param jsonNode json node
   * @param problems problem collection
   * @param message diagnostic message
   * @param isContainer identify if json node is a container (e.g. object or array)
   */
  private static addProblem(jsonNode: parser.Node, problems: Problem[], message: string, isContainer?: boolean): void {
    const length: number = isContainer ? 0 : jsonNode.length;
    problems.push({ offset: jsonNode.offset, length, message });
  }

  /**
   * validate json node by DigitalTwin graph, add problem to collection
   * @param jsonNode json node
   * @param digitalTwinNode DigitalTwin property node
   * @param problems problem collection
   */
  private static validateNode(jsonNode: parser.Node, digitalTwinNode: PropertyNode, problems: Problem[]): void {
    const nodeType: parser.NodeType = jsonNode.type;
    switch (nodeType) {
      case JsonNodeType.Object:
        DigitalTwinDiagnosticProvider.validateObjectNode(jsonNode, digitalTwinNode, problems);
        break;
      case JsonNodeType.Array:
        DigitalTwinDiagnosticProvider.validateArrayNode(jsonNode, digitalTwinNode, problems);
        break;
      case JsonNodeType.String:
        DigitalTwinDiagnosticProvider.validateStringNode(jsonNode, digitalTwinNode, problems);
        break;
      case JsonNodeType.Number:
        DigitalTwinDiagnosticProvider.validateNumberNode(jsonNode, digitalTwinNode, problems);
        break;
      case JsonNodeType.Boolean:
        DigitalTwinDiagnosticProvider.validateBooleanNode(jsonNode, digitalTwinNode, problems);
        break;
      default:
    }
  }

  /**
   * validate json object node
   * @param jsonNode json node
   * @param digitalTwinNode DigitalTwin property node
   * @param problems problem collection
   */
  private static validateObjectNode(jsonNode: parser.Node, digitalTwinNode: PropertyNode, problems: Problem[]): void {
    const classes: ClassNode[] = IntelliSenseUtility.getObverseClasses(digitalTwinNode);
    if (!classes.length) {
      DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, DiagnosticMessage.NotObjectType);
      return;
    }
    if (!jsonNode.children || !jsonNode.children.length) {
      DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, DiagnosticMessage.EmptyObject, true);
      return;
    }
    const typePath: parser.JSONPath = [DigitalTwinConstants.TYPE];
    const typeNode: parser.Node | undefined = parser.findNodeAtLocation(jsonNode, typePath);
    // @type is required when there are multiple choices
    if (!typeNode && classes.length !== 1) {
      DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, DiagnosticMessage.MissingType, true);
      return;
    }
    // validate @type property
    let classNode: ClassNode | undefined;
    if (typeNode) {
      classNode = DigitalTwinDiagnosticProvider.getValidObjectType(typeNode, classes, problems);
    } else {
      classNode = classes[0];
    }
    if (!classNode) {
      return;
    }
    // validate language string
    if (IntelliSenseUtility.isLanguageString(classNode)) {
      DigitalTwinDiagnosticProvider.validateLanguageString(jsonNode, digitalTwinNode, problems);
      return;
    }
    // validate properties
    const exist = new Set<string>();
    DigitalTwinDiagnosticProvider.validateProperties(jsonNode, classNode, problems, exist);
    // validate required property
  }

  /**
   * get valid object type from classes
   * @param jsonNode json node
   * @param classes class node collection
   * @param problems problem collection
   */
  private static getValidObjectType(
    jsonNode: parser.Node,
    classes: ClassNode[],
    problems: Problem[],
  ): ClassNode | undefined {
    let classNode: ClassNode | undefined;
    if (jsonNode.type === JsonNodeType.String) {
      classNode = classes.find((c) => c.name === (jsonNode.value as string));
    } else if (jsonNode.type === JsonNodeType.Array && jsonNode.children) {
      // support semantic type
      let lastNode: ClassNode | undefined;
      let currentNode: ClassNode | undefined;
      for (const child of jsonNode.children) {
        if (child.type !== JsonNodeType.String) {
          classNode = undefined;
          break;
        }
        currentNode = classes.find((c) => c.name === (child.value as string));
        // TODO: need validate Semantic Type value
        if (!currentNode) {
          continue;
        }
        // validate conflict type
        if (lastNode) {
          const message = `${DiagnosticMessage.ConflictType} ${lastNode.name} and ${currentNode.name}`;
          DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, message);
          return undefined;
        } else {
          lastNode = currentNode;
        }
        if (currentNode.isAugmentable) {
          classNode = currentNode;
        }
      }
      if (!classNode) {
        DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, DiagnosticMessage.CoTypeNotAllowed);
        return undefined;
      }
    }
    if (!classNode) {
      const validTypes: string[] = classes.map((c) => c.name);
      DigitalTwinDiagnosticProvider.addProblemOfInvalidType(jsonNode, problems, validTypes);
    }
    return classNode;
  }

  /**
   * validate language string
   * @param jsonNode json node
   * @param digitalTwinNode DigitalTwin property node
   * @param problems problem collection
   */
  private static validateLanguageString(
    jsonNode: parser.Node,
    digitalTwinNode: PropertyNode,
    problems: Problem[],
  ): void {
    if (!jsonNode.children) {
      return;
    }
    let propertyName: string;
    let propertyPair: PropertyPair | undefined;
    // validate all language tags
    for (const child of jsonNode.children) {
      propertyPair = IntelliSenseUtility.parseProperty(child);
      if (!propertyPair) {
        continue;
      }
      propertyName = propertyPair.name.value as string;
      if (!LANGUAGE_CODE.has(propertyName)) {
        DigitalTwinDiagnosticProvider.addProblemOfUnexpectedProperty(propertyPair.name, problems);
      } else if (propertyPair.value.type !== JsonNodeType.String) {
        DigitalTwinDiagnosticProvider.addProblem(propertyPair.value, problems, DiagnosticMessage.ValueNotString);
      } else {
        DigitalTwinDiagnosticProvider.validateStringNode(propertyPair.value, digitalTwinNode, problems);
      }
    }
  }

  /**
   * validate properties of json object node
   * @param jsonNode json node
   * @param classNode class node
   * @param problems problem colletion
   * @param exist existing properties
   */
  private static validateProperties(
    jsonNode: parser.Node,
    classNode: ClassNode,
    problems: Problem[],
    exist: Set<string>,
  ): void {}

  /**
   * validate json array node
   * @param jsonNode json node
   * @param digitalTwinNode DigitalTwin property node
   * @param problems problem collection
   */
  private static validateArrayNode(jsonNode: parser.Node, digitalTwinNode: PropertyNode, problems: Problem[]): void {
    if (!digitalTwinNode.isPlural || digitalTwinNode.type === Literal.LangString) {
      DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, DiagnosticMessage.NotArrayType);
      return;
    }
    if (!jsonNode.children || !jsonNode.children.length) {
      DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, DiagnosticMessage.EmptyArray, true);
      return;
    }
    // validate array constraint
    let message: string;
    if (digitalTwinNode.constraint.minCount && jsonNode.children.length < digitalTwinNode.constraint.minCount) {
      message = `${DiagnosticMessage.LessThanMinCount} ${digitalTwinNode.constraint.minCount}.`;
      DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, message, true);
    } else if (digitalTwinNode.constraint.maxCount && jsonNode.children.length > digitalTwinNode.constraint.maxCount) {
      message = `${DiagnosticMessage.GreaterThanMaxCount} ${digitalTwinNode.constraint.maxCount}.`;
      DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, message, true);
    }
    // validate uniqueness by dictionary key
    let propertyPair: PropertyPair | undefined;
    let objectName: string;
    const exist = new Set<string>();
    for (const child of jsonNode.children) {
      propertyPair = DigitalTwinDiagnosticProvider.getNamePropertyPair(child);
      if (propertyPair) {
        objectName = propertyPair.value.value as string;
        if (exist.has(objectName)) {
          message = `${objectName} ${DiagnosticMessage.DuplicateItem}`;
          DigitalTwinDiagnosticProvider.addProblem(propertyPair.value, problems, message);
        } else {
          exist.add(objectName);
        }
      }
      DigitalTwinDiagnosticProvider.validateNode(child, digitalTwinNode, problems);
    }
  }

  /**
   * validate json string node
   * @param jsonNode json node
   * @param digitalTwinNode DigitalTwin property node
   * @param problems problem collection
   */
  private static validateStringNode(jsonNode: parser.Node, digitalTwinNode: PropertyNode, problems: Problem[]): void {
    // validate IRI or instance
    if (digitalTwinNode.nodeKind === DigitalTwinConstants.IRI) {
      DigitalTwinDiagnosticProvider.validateIRINode(jsonNode, digitalTwinNode, problems);
      return;
    }
    if (
      digitalTwinNode.type &&
      digitalTwinNode.type !== Literal.String &&
      digitalTwinNode.type !== Literal.LangString
    ) {
      const typeName: string = IntelliSenseUtility.resolveTypeName(digitalTwinNode.type);
      DigitalTwinDiagnosticProvider.addProblemOfInvalidType(jsonNode, problems, [typeName]);
      return;
    }
    const value: string = jsonNode.value as string;
    if (!value) {
      DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, DiagnosticMessage.EmptyString);
      return;
    }
    // validate string constraint
    let message: string;
    if (digitalTwinNode.constraint.minLength && value.length < digitalTwinNode.constraint.minLength) {
      message = `${DiagnosticMessage.LessThanMinLength} ${digitalTwinNode.constraint.minLength}.`;
      DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, message);
      return;
    }
    if (digitalTwinNode.constraint.maxLength && value.length > digitalTwinNode.constraint.maxLength) {
      message = `${DiagnosticMessage.GreaterThanMaxLength} ${digitalTwinNode.constraint.maxLength}.`;
      DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, message);
      return;
    }
    if (digitalTwinNode.constraint.pattern) {
      const regex = new RegExp(digitalTwinNode.constraint.pattern);
      if (!regex.test(value)) {
        message = `${DiagnosticMessage.NotMatchPattern} ${digitalTwinNode.constraint.pattern}.`;
        DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, message);
      }
    }
  }

  /**
   * validate IRI or instance
   * @param jsonNode json node
   * @param digitalTwinNode DigitalTwin property node
   * @param problems problem collection
   */
  private static validateIRINode(jsonNode: parser.Node, digitalTwinNode: PropertyNode, problems: Problem[]): void {
    // constraint is prior to type, e.g. valueSchema
    let instances: string[];
    if (digitalTwinNode.constraint.in) {
      instances = digitalTwinNode.constraint.in.map((id) => IntelliSenseUtility.resolveNodeName(id));
      DigitalTwinDiagnosticProvider.validateInstance(jsonNode, instances, problems);
      return;
    }
    if (!digitalTwinNode.type) {
      DigitalTwinDiagnosticProvider.validateDtmi(jsonNode, problems);
      return;
    }
    const classNode: ClassNode | undefined = IntelliSenseUtility.getClassNode(digitalTwinNode.type);
    if (!classNode) {
      return;
    }
    // validate instance
    instances = IntelliSenseUtility.getInstancesOfClassNode(classNode);
    if (!instances.length) {
      DigitalTwinDiagnosticProvider.validateDtmi(jsonNode, problems);
      return;
    }
    DigitalTwinDiagnosticProvider.validateInstance(jsonNode, instances, problems);
    instances.length = 0;
  }

  /**
   *
   * @param jsonNode json node
   * @param instances instance collection
   * @param problems problem collection
   */
  private static validateInstance(jsonNode: parser.Node, instances: string[], problems: Problem[]): void {
    if (!instances.includes(jsonNode.value as string)) {
      instances.unshift(DiagnosticMessage.InvalidValue);
      const message: string = instances.join(DigitalTwinConstants.LINE_FEED);
      DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, message);
    }
  }

  /**
   * validate dtmi id
   * @param jsonNode json node
   * @param problems problem collection
   */
  private static validateDtmi(jsonNode: parser.Node, problems: Problem[]): void {
    const id: string = jsonNode.value as string;
    if (id.length > DigitalTwinConstants.DTMI_MAX_LENGTH) {
      DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, DiagnosticMessage.InvalidDtmiLength);
      return;
    }
    const regex = new RegExp(DigitalTwinConstants.DTMI_REGEX);
    if (!regex.test(id)) {
      DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, DiagnosticMessage.InvalidDtmiPattern);
    }
  }

  /**
   * validate json number node
   * @param jsonNode json node
   * @param digitalTwinNode DigitalTwin property node
   * @param problems problem collection
   */
  private static validateNumberNode(jsonNode: parser.Node, digitalTwinNode: PropertyNode, problems: Problem[]): void {
    if (digitalTwinNode.type && digitalTwinNode.type !== Literal.Integer) {
      const typeName: string = IntelliSenseUtility.resolveTypeName(digitalTwinNode.type);
      DigitalTwinDiagnosticProvider.addProblemOfInvalidType(jsonNode, problems, [typeName]);
      return;
    }
    const value: number = jsonNode.value as number;
    // validate number is integer
    if (!Number.isInteger(value)) {
      DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, DiagnosticMessage.ValueNotInteger);
      return;
    }
    // validate number constraint
    let message: string;
    if (digitalTwinNode.constraint.minInclusive && value < digitalTwinNode.constraint.minInclusive) {
      message = `${DiagnosticMessage.LessThanMinValue} ${digitalTwinNode.constraint.minInclusive}.`;
      DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, message);
      return;
    }
    if (digitalTwinNode.constraint.maxInclusive && value > digitalTwinNode.constraint.maxInclusive) {
      message = `${DiagnosticMessage.GreaterThanMaxValue} ${digitalTwinNode.constraint.maxInclusive}.`;
      DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, message);
    }
  }

  /**
   * validate json boolean node
   * @param jsonNode json node
   * @param digitalTwinNode DigitalTwin property node
   * @param problems problem collection
   */
  private static validateBooleanNode(jsonNode: parser.Node, digitalTwinNode: PropertyNode, problems: Problem[]): void {
    if (digitalTwinNode.type && digitalTwinNode.type !== Literal.Boolean) {
      const typeName: string = IntelliSenseUtility.resolveTypeName(digitalTwinNode.type);
      DigitalTwinDiagnosticProvider.addProblemOfInvalidType(jsonNode, problems, [typeName]);
    }
  }

  /**
   * update diagnostics
   * @param document text document
   * @param collection diagnostic collection
   */
  public updateDiagnostics(document: vscode.TextDocument, collection: vscode.DiagnosticCollection): void {
    if (!IntelliSenseUtility.isGraphInitialized()) {
      return;
    }
    const modelContent: ModelContent | undefined = IntelliSenseUtility.parseDigitalTwinModel(document.getText());
    if (!modelContent) {
      // clear diagnostic cache if file is no longer for DigitalTwin
      collection.delete(document.uri);
      return;
    }
    const diagnostics: vscode.Diagnostic[] = this.provideDiagnostics(document, modelContent.jsonNode);
    collection.set(document.uri, diagnostics);
  }

  /**
   * provide diagnostics
   * @param document text document
   * @param jsonNode json node
   */
  private provideDiagnostics(document: vscode.TextDocument, jsonNode: parser.Node): vscode.Diagnostic[] {
    let diagnostics: vscode.Diagnostic[] = [];
    const digitalTwinNode: PropertyNode | undefined = IntelliSenseUtility.getEntryNode();
    if (!digitalTwinNode) {
      return diagnostics;
    }
    const problems: Problem[] = [];
    DigitalTwinDiagnosticProvider.validateNode(jsonNode, digitalTwinNode, problems);
    diagnostics = problems.map(
      (p) =>
        new vscode.Diagnostic(
          new vscode.Range(document.positionAt(p.offset), document.positionAt(p.offset + p.length)),
          p.message,
          vscode.DiagnosticSeverity.Error,
        ),
    );
    problems.length = 0;
    return diagnostics;
  }
}
