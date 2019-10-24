// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as parser from "jsonc-parser";
import * as vscode from "vscode";
import { Constants } from "../common/constants";
import { DiagnosticMessage, DigitalTwinConstants } from "./digitalTwinConstants";
import { ClassNode, DigitalTwinGraph, PropertyNode, ValueSchema } from "./digitalTwinGraph";
import { IntelliSenseUtility, JsonNodeType, PropertyPair } from "./intelliSenseUtility";

interface Problem {
  offset: number;
  length: number;
  message: string;
}

export class DigitalTwinDiagnosticProvider {
  private static findClassNode(digitalTwinNode: PropertyNode, type: string): ClassNode | undefined {
    if (digitalTwinNode.range) {
      return digitalTwinNode.range.find((c) => DigitalTwinGraph.getClassType(c) === type);
    }
    return undefined;
  }

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

  private static addProblemOfInvalidType(
    jsonNode: parser.Node,
    digitalTwinNode: PropertyNode,
    problems: Problem[],
  ): void {
    const validTypes: string[] = DigitalTwinGraph.getValidTypes(digitalTwinNode);
    const message: string = [DiagnosticMessage.InvalidType, ...validTypes].join(Constants.LINE_FEED);
    DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, message);
  }

  private static addProblemOfUnexpectedProperty(jsonNode: parser.Node, problems: Problem[]): void {
    const message: string = `${jsonNode.value as string} ${DiagnosticMessage.UnexpectedProperty}`;
    DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, message);
  }

  private static addProblem(jsonNode: parser.Node, problems: Problem[], message: string, isContainer?: boolean): void {
    const length: number = isContainer ? 0 : jsonNode.length;
    problems.push({ offset: jsonNode.offset, length, message });
  }

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
      default:
    }
  }

  private static validateObjectNode(jsonNode: parser.Node, digitalTwinNode: PropertyNode, problems: Problem[]): void {
    const classes: ClassNode[] = IntelliSenseUtility.getObjectClasses(digitalTwinNode);
    if (classes.length === 0) {
      DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, DiagnosticMessage.NotObjectType);
      return;
    }
    const typePath: parser.JSONPath = [DigitalTwinConstants.TYPE];
    const typeNode: parser.Node | undefined = parser.findNodeAtLocation(jsonNode, typePath);
    // @type is required when property range has multiple choice
    if (!typeNode && classes.length !== 1) {
      DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, DiagnosticMessage.MissingType, true);
      return;
    }

    // validate @type property
    let classNode: ClassNode | undefined;
    if (typeNode) {
      classNode = DigitalTwinDiagnosticProvider.getValidObjectType(typeNode, digitalTwinNode, classes, problems);
    } else {
      classNode = classes[0];
    }
    if (!classNode) {
      return;
    }

    // validate other properties
    const exist = new Set<string>();
    DigitalTwinDiagnosticProvider.validateProperties(jsonNode, classNode, problems, exist);
    // validate required property
    if (classNode.constraint && classNode.constraint.required) {
      const requiredProperty: string[] = classNode.constraint.required.filter((p) => !exist.has(p));
      if (requiredProperty.length > 0) {
        const message: string = [DiagnosticMessage.MissingRequiredProperties, ...requiredProperty].join(
          Constants.LINE_FEED,
        );
        DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, message, true);
      }
    }
  }

  private static getValidObjectType(
    jsonNode: parser.Node,
    digitalTwinNode: PropertyNode,
    classes: ClassNode[],
    problems: Problem[],
  ): ClassNode | undefined {
    let classNode: ClassNode | undefined;
    const dummyNode: PropertyNode = { id: DigitalTwinConstants.DUMMY_NODE, range: classes };
    if (jsonNode.type === JsonNodeType.String) {
      classNode = DigitalTwinDiagnosticProvider.findClassNode(dummyNode, jsonNode.value as string);
    } else if (jsonNode.type === JsonNodeType.Array && digitalTwinNode.label === DigitalTwinConstants.CONTENTS) {
      // contents support semanticType array
      if (jsonNode.children && jsonNode.children.length === 2) {
        let currentNode: ClassNode | undefined;
        for (const child of jsonNode.children) {
          if (child.type === JsonNodeType.String) {
            currentNode = DigitalTwinDiagnosticProvider.findClassNode(dummyNode, child.value as string);
            if (currentNode) {
              if (classNode) {
                const message: string = `${DiagnosticMessage.ConflictType} ${classNode.label} and ${currentNode.label}`;
                DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, message);
                return undefined;
              } else {
                classNode = currentNode;
              }
            }
          }
        }
      }
    }
    if (!classNode) {
      DigitalTwinDiagnosticProvider.addProblemOfInvalidType(jsonNode, dummyNode, problems);
    }
    return classNode;
  }

  private static validateProperties(
    jsonNode: parser.Node,
    classNode: ClassNode,
    problems: Problem[],
    exist: Set<string>,
  ): void {
    if (!jsonNode.children) {
      return;
    }
    const expectedProperties = new Map<string, PropertyNode>();
    if (classNode.properties) {
      classNode.properties.forEach((p) => {
        if (p.label) {
          expectedProperties.set(p.label, p);
        }
      });
    }
    let propertyName: string;
    let propertyPair: PropertyPair | undefined;
    let propertyNode: PropertyNode | undefined;
    for (const child of jsonNode.children) {
      propertyPair = IntelliSenseUtility.parseProperty(child);
      if (!propertyPair) {
        continue;
      }
      propertyName = propertyPair.name.value as string;
      // duplicate property name is handled by json validator
      exist.add(propertyName);
      switch (propertyName) {
        case DigitalTwinConstants.ID:
          // @id is available for each class
          propertyNode = IntelliSenseUtility.getPropertyNode(propertyName);
          if (propertyNode) {
            DigitalTwinDiagnosticProvider.validateNode(propertyPair.value, propertyNode, problems);
          }
          break;
        case DigitalTwinConstants.CONTEXT:
          // @context is available when it is required
          if (
            classNode.constraint &&
            classNode.constraint.required &&
            classNode.constraint.required.includes(propertyName)
          ) {
            if (!IntelliSenseUtility.isDigitalTwinContext(propertyPair.value)) {
              DigitalTwinDiagnosticProvider.addProblem(propertyPair.value, problems, DiagnosticMessage.InvalidContext);
            }
          } else {
            DigitalTwinDiagnosticProvider.addProblemOfUnexpectedProperty(propertyPair.name, problems);
          }
          break;
        case DigitalTwinConstants.TYPE:
          // skip since @type is already validated
          break;
        default:
          propertyNode = expectedProperties.get(propertyName);
          if (!propertyNode) {
            DigitalTwinDiagnosticProvider.addProblemOfUnexpectedProperty(propertyPair.name, problems);
          } else {
            DigitalTwinDiagnosticProvider.validateNode(propertyPair.value, propertyNode, problems);
          }
      }
    }
  }

  private static validateArrayNode(jsonNode: parser.Node, digitalTwinNode: PropertyNode, problems: Problem[]): void {
    if (!digitalTwinNode.isArray) {
      DigitalTwinDiagnosticProvider.addProblemOfInvalidType(jsonNode, digitalTwinNode, problems);
      return;
    }
    if (!jsonNode.children || jsonNode.children.length === 0) {
      DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, DiagnosticMessage.EmptyArray, true);
      return;
    }

    let message: string;
    if (digitalTwinNode.constraint) {
      if (digitalTwinNode.constraint.minItems && jsonNode.children.length < digitalTwinNode.constraint.minItems) {
        message = `${DiagnosticMessage.TooFewItems} ${digitalTwinNode.constraint.minItems}.`;
        DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, message, true);
      }
      if (digitalTwinNode.constraint.maxItems && jsonNode.children.length > digitalTwinNode.constraint.maxItems) {
        message = `${DiagnosticMessage.TooManyItems} ${digitalTwinNode.constraint.maxItems}.`;
        DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, message, true);
      }
    }

    let propertyPair: PropertyPair | undefined;
    let objectName: string;
    const exist = new Set<string>();
    for (const child of jsonNode.children) {
      // validate item uniqueness by name
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

  private static validateStringNode(jsonNode: parser.Node, digitalTwinNode: PropertyNode, problems: Problem[]): void {
    const classNode: ClassNode | undefined = DigitalTwinDiagnosticProvider.findClassNode(
      digitalTwinNode,
      ValueSchema.String,
    );
    if (!classNode) {
      DigitalTwinDiagnosticProvider.validateEnumNode(jsonNode, digitalTwinNode, problems);
      return;
    }
    const value: string = jsonNode.value as string;
    if (!value) {
      DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, DiagnosticMessage.EmptyString);
      return;
    }

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

  private static validateEnumNode(jsonNode: parser.Node, digitalTwinNode: PropertyNode, problems: Problem[]): void {
    const enums: string[] = IntelliSenseUtility.getEnums(digitalTwinNode);
    if (enums.length === 0) {
      DigitalTwinDiagnosticProvider.addProblemOfInvalidType(jsonNode, digitalTwinNode, problems);
    } else if (!enums.includes(jsonNode.value as string)) {
      const message: string = [DiagnosticMessage.InvalidEnum, ...enums].join(Constants.LINE_FEED);
      DigitalTwinDiagnosticProvider.addProblem(jsonNode, problems, message);
    }
  }

  private static validateNumberNode(jsonNode: parser.Node, digitalTwinNode: PropertyNode, problems: Problem[]): void {
    const classNode: ClassNode | undefined = DigitalTwinDiagnosticProvider.findClassNode(
      digitalTwinNode,
      ValueSchema.Int,
    );
    if (!classNode || !Number.isInteger(jsonNode.value as number)) {
      DigitalTwinDiagnosticProvider.addProblemOfInvalidType(jsonNode, digitalTwinNode, problems);
      return;
    }
  }

  private static validateBooleanNode(jsonNode: parser.Node, digitalTwinNode: PropertyNode, problems: Problem[]): void {
    const classNode: ClassNode | undefined = DigitalTwinDiagnosticProvider.findClassNode(
      digitalTwinNode,
      ValueSchema.Boolean,
    );
    if (!classNode) {
      DigitalTwinDiagnosticProvider.addProblemOfInvalidType(jsonNode, digitalTwinNode, problems);
      return;
    }
  }

  public updateDiagnostics(document: vscode.TextDocument, collection: vscode.DiagnosticCollection): void {
    const jsonNode: parser.Node | undefined = IntelliSenseUtility.parseDigitalTwinModel(document);
    if (!jsonNode) {
      return;
    }
    collection.delete(document.uri);
    const diagnostics: vscode.Diagnostic[] = this.provideDiagnostics(document, jsonNode);
    collection.set(document.uri, diagnostics);
  }

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
    return diagnostics;
  }
}
