// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as parser from "jsonc-parser";
import * as vscode from "vscode";
import { Constants } from "../common/constants";
import { DiagnosticMessage, DigitalTwinConstants } from "./digitalTwinConstants";
import { ClassNode, DigitalTwinGraph, PropertyNode } from "./digitalTwinGraph";
import { IntelliSenseUtility, JsonNodeType, PropertyPair } from "./intelliSenseUtility";
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
   * @param digitalTwinNode DigitalTwin property node
   * @param problems problem collection
   */
  private static addProblemOfInvalidType(
    jsonNode: parser.Node,
    digitalTwinNode: PropertyNode,
    problems: Problem[],
  ): void {
    const validTypes: string[] = [];
    const message: string = [DiagnosticMessage.InvalidType, ...validTypes].join(Constants.LINE_FEED);
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
   * add problem
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
   * validate json node by DigitalTwin graph, add problem in problem collection
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
    const classes: ClassNode[] = [];
    if (classes.length === 0) {
      DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, DiagnosticMessage.NotObjectType);
      return;
    }
    if (!jsonNode.children || jsonNode.children.length === 0) {
      DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, DiagnosticMessage.EmptyObject, true);
      return;
    }
    const typePath: parser.JSONPath = [DigitalTwinConstants.TYPE];
    const typeNode: parser.Node | undefined = parser.findNodeAtLocation(jsonNode, typePath);
    // @type is required when there are multiple choice
    if (!typeNode && classes.length !== 1) {
      DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, DiagnosticMessage.MissingType, true);
      return;
    }
    // validate @type property
    let classNode: ClassNode | undefined;
    if (typeNode) {
    } else {
      classNode = classes[0];
    }
    if (!classNode) {
      return;
    }
    // validate language node
    // validate other properties
    const exist = new Set<string>();
    DigitalTwinDiagnosticProvider.validateProperties(jsonNode, classNode, problems, exist);
    // validate required property
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
    if (!digitalTwinNode.isPlural) {
      DigitalTwinDiagnosticProvider.addProblemOfInvalidType(jsonNode, digitalTwinNode, problems);
      return;
    }
    if (!jsonNode.children || jsonNode.children.length === 0) {
      DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, DiagnosticMessage.EmptyArray, true);
      return;
    }
    // validate item constraint
    let message: string;
    if (digitalTwinNode.constraint) {
      if (digitalTwinNode.constraint.minCount && jsonNode.children.length < digitalTwinNode.constraint.minCount) {
        message = `${DiagnosticMessage.TooFewItems} ${digitalTwinNode.constraint.minCount}.`;
        DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, message, true);
      }
      if (digitalTwinNode.constraint.maxCount && jsonNode.children.length > digitalTwinNode.constraint.maxCount) {
        message = `${DiagnosticMessage.TooManyItems} ${digitalTwinNode.constraint.maxCount}.`;
        DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, message, true);
      }
    }
    // validate item uniqueness by name
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
    const classNode: ClassNode | undefined = undefined;
    // validate enum node
    if (!classNode) {
      DigitalTwinDiagnosticProvider.validateEnumNode(jsonNode, digitalTwinNode, problems);
      return;
    }
    const value: string = jsonNode.value as string;
    if (!value) {
      DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, DiagnosticMessage.EmptyString);
      return;
    }
    // validate string constraint
    let message: string;
    if (digitalTwinNode.constraint) {
      if (digitalTwinNode.constraint.minLength && value.length < digitalTwinNode.constraint.minLength) {
        message = `${DiagnosticMessage.ShorterThanMinLength} ${digitalTwinNode.constraint.minLength}.`;
        DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, message);
        return;
      } else if (digitalTwinNode.constraint.maxLength && value.length > digitalTwinNode.constraint.maxLength) {
        message = `${DiagnosticMessage.LongerThanMaxLength} ${digitalTwinNode.constraint.maxLength}.`;
        DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, message);
        return;
      } else if (digitalTwinNode.constraint.pattern) {
        const regex = new RegExp(digitalTwinNode.constraint.pattern);
        if (!regex.test(value)) {
          message = `${DiagnosticMessage.NotMatchPattern} ${digitalTwinNode.constraint.pattern}.`;
          DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, message);
          return;
        }
      }
    }
  }

  /**
   * validate enum
   * @param jsonNode json node
   * @param digitalTwinNode DigitalTwin property node
   * @param problems problem collection
   */
  private static validateEnumNode(jsonNode: parser.Node, digitalTwinNode: PropertyNode, problems: Problem[]): void {
    const enums: string[] = [];
    if (enums.length === 0) {
      DigitalTwinDiagnosticProvider.addProblemOfInvalidType(jsonNode, digitalTwinNode, problems);
    } else if (!enums.includes(jsonNode.value as string)) {
      const message: string = [DiagnosticMessage.InvalidEnum, ...enums].join(Constants.LINE_FEED);
      DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, message);
    }
  }

  /**
   * validate json number node
   * @param jsonNode json node
   * @param digitalTwinNode DigitalTwin property node
   * @param problems problem collection
   */
  private static validateNumberNode(jsonNode: parser.Node, digitalTwinNode: PropertyNode, problems: Problem[]): void {
    const classNode: ClassNode | undefined = undefined;
    // validate number is integer
    if (!classNode || !Number.isInteger(jsonNode.value as number)) {
      DigitalTwinDiagnosticProvider.addProblemOfInvalidType(jsonNode, digitalTwinNode, problems);
      return;
    }
  }

  /**
   * validate boolean node
   * @param jsonNode json node
   * @param digitalTwinNode DigitalTwin property node
   * @param problems problem collection
   */
  private static validateBooleanNode(jsonNode: parser.Node, digitalTwinNode: PropertyNode, problems: Problem[]): void {
    const classNode: ClassNode | undefined = undefined;
    if (!classNode) {
      DigitalTwinDiagnosticProvider.addProblemOfInvalidType(jsonNode, digitalTwinNode, problems);
      return;
    }
  }

  /**
   * validate language node
   * @param jsonNode json node
   * @param digitalTwinNode DigitalTwin property node
   * @param problems problem collection
   */
  private static validateLanguageNode(jsonNode: parser.Node, digitalTwinNode: PropertyNode, problems: Problem[]): void {
    if (!jsonNode.children) {
      return;
    }
    let propertyName: string;
    let propertyPair: PropertyPair | undefined;
    for (const child of jsonNode.children) {
      propertyPair = IntelliSenseUtility.parseProperty(child);
      if (!propertyPair) {
        continue;
      }
      propertyName = propertyPair.name.value as string;
      if (!LANGUAGE_CODE.has(propertyName)) {
        DigitalTwinDiagnosticProvider.addProblemOfUnexpectedProperty(propertyPair.name, problems);
      } else if (typeof propertyPair.value.value !== "string") {
        DigitalTwinDiagnosticProvider.addProblem(propertyPair.value, problems, DiagnosticMessage.ValueNotString);
      } else {
        DigitalTwinDiagnosticProvider.validateStringNode(propertyPair.value, digitalTwinNode, problems);
      }
    }
  }

  /**
   * update diagnostics
   * @param document text document
   * @param collection diagnostic collection
   */
  public updateDiagnostics(document: vscode.TextDocument, collection: vscode.DiagnosticCollection): void {
    // clean diagnostic cache
    collection.delete(document.uri);
    const jsonNode: parser.Node | undefined = IntelliSenseUtility.parseDigitalTwinModel(document.getText());
    if (!jsonNode) {
      return;
    }
    if (!IntelliSenseUtility.enabled()) {
      return;
    }
    const diagnostics: vscode.Diagnostic[] = this.provideDiagnostics(document, jsonNode);
    collection.set(document.uri, diagnostics);
  }

  /**
   * provide diagnostics
   * @param document text document
   * @param jsonNode json node
   */
  private provideDiagnostics(document: vscode.TextDocument, jsonNode: parser.Node): vscode.Diagnostic[] {
    let diagnostics: vscode.Diagnostic[] = [];
    const digitalTwinNode: PropertyNode | undefined = undefined;
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
    return diagnostics;
  }
}
