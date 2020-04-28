// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as parser from "jsonc-parser";
import * as vscode from "vscode";
import { Constants } from "../common/constants";
import { DigitalTwinConstants } from "./digitalTwinConstants";
import { ClassNode, NodeType, PropertyNode } from "./digitalTwinGraph";
import { IntelliSenseUtility, JsonNodeType, ModelContent, PropertyPair } from "./intelliSenseUtility";
import { LANGUAGE_CODE } from "./languageCode";

interface Suggestion {
  isProperty: boolean;
  label: string;
  insertText: string;
  withSeparator: boolean;
}

/**
 * Completion item provider for DigitalTwin IntelliSense
 */
export class DigitalTwinCompletionItemProvider
  implements vscode.CompletionItemProvider {
  private static getDocumentNode(document: vscode.TextDocument, position: vscode.Position): parser.Node {
    let text: string = document.getText();
    let textNode: parser.Node = parser.parseTree(text);
    if (textNode && textNode.type === JsonNodeType.Property) {
      const offset: number = document.offsetAt(position);
      text = DigitalTwinCompletionItemProvider.completeText(text, offset);
      textNode = parser.parseTree(text);
    }
    return textNode;
  }

  private static completeText(text: string, offset: number): string {
    if (text[offset] === Constants.COMPLETION_TRIGGER) {
      text = parser.applyEdits(text, [
        {
          offset,
          length: 1,
          content: Constants.COMPLETION_TRIGGER + Constants.DEFAULT_SEPARATOR,
        },
      ]);
    }
    return text;
  }

  private static getSuggestion(stringNode: parser.Node): Suggestion[] {
    const jsonPropertyNode: parser.Node | undefined = stringNode.parent;
    if (!jsonPropertyNode || jsonPropertyNode.type !== JsonNodeType.Property || !jsonPropertyNode.children) {
      return [];
    }

    if (stringNode === jsonPropertyNode.children[0]) {
      const suggestWithValue: boolean = jsonPropertyNode.children.length < 2;
      return DigitalTwinCompletionItemProvider.suggestKey(jsonPropertyNode, suggestWithValue);
    } else {
      return DigitalTwinCompletionItemProvider.suggestValue(jsonPropertyNode);
    }
  }

  private static suggestKey(
    jsonPropertyNode: parser.Node,
    suggestWithValue: boolean,
  ): Suggestion[] {
    const existedProperties = DigitalTwinCompletionItemProvider.getExistedProperties(jsonPropertyNode);

    const type = DigitalTwinCompletionItemProvider.tryGetType(jsonPropertyNode);
    if (!type) {
      // type is neither defined nor inferable. User should destinate @type first.
      return DigitalTwinCompletionItemProvider.suggestTypeKey(suggestWithValue);
    } else {
      return DigitalTwinCompletionItemProvider.suggestPropertiesCandidates(type, existedProperties, suggestWithValue);
    }
  }

  private static getExistedProperties(jsonPropertyNode: parser.Node): string[] {
    const existedProperties: string[] = [];
    const parentObjectNode: parser.Node | undefined = jsonPropertyNode.parent;
    if (!parentObjectNode || parentObjectNode.type !== JsonNodeType.Object || !parentObjectNode.children) {
      return existedProperties;
    }

    for (const child of parentObjectNode.children) {
      if (child === jsonPropertyNode) {
        continue;
      }

      const propertyPair: PropertyPair|undefined = IntelliSenseUtility.parseProperty(child);
      if (propertyPair) {
        const jsonPropertyKey = propertyPair.name.value;
        existedProperties.push(jsonPropertyKey);
      }
    }
    return existedProperties;
  }

  private static tryGetType(jsonPropertyNode: parser.Node): string|undefined {
    const parentObjectNode: parser.Node | undefined = jsonPropertyNode.parent;
    if (!parentObjectNode || parentObjectNode.type !== JsonNodeType.Object || !parentObjectNode.children) {
      return undefined;
    }

    let type: string|undefined = DigitalTwinCompletionItemProvider.tryGetTypeByTypeProperty(parentObjectNode);
    if (!type) {
      type = DigitalTwinCompletionItemProvider.tryGetTypeByOuterProperty(jsonPropertyNode);
    }

    return type;
  }

  private static tryGetTypeByTypeProperty(objectNode: parser.Node): string|undefined {
    if (objectNode.children) {
      for (const child of objectNode.children) {
        const property: PropertyPair|undefined = IntelliSenseUtility.parseProperty(child);
        if (property && property.name.value === DigitalTwinConstants.TYPE) {
          return property.value.value as string;
        }
      }
    }
    return undefined;
  }

  private static tryGetTypeByOuterProperty(jsonPropertyNode: parser.Node): string|undefined {
    const outerPropertyClassNode: ClassNode|undefined =
      IntelliSenseUtility.getOuterPropertyClassNode(jsonPropertyNode);

    if (outerPropertyClassNode && !outerPropertyClassNode.isAbstract) {
      return outerPropertyClassNode.name;
    } else {
      return undefined;
    }
  }

  private static suggestTypeKey(suggestWithValue: boolean): Suggestion[] {
    const suggestions: Suggestion[] = [];

    const dummyTypeNode: PropertyNode = {
      id: "dummy-type",
      name: DigitalTwinConstants.TYPE,
      nodeKind: Constants.EMPTY_STRING,
      type: Constants.EMPTY_STRING,
      constraint: {},
    };
    suggestions.push({
      isProperty: true,
      label: DigitalTwinCompletionItemProvider.formatLabel(dummyTypeNode.name, true),
      insertText: DigitalTwinCompletionItemProvider.getInsertedTextForProperty(dummyTypeNode, suggestWithValue),
      withSeparator: suggestWithValue,
    });

    return suggestions;
  }

  /**
   * get insert text for property
   * @param propertyNode DigitalTwin property node
   * @param includeValue identify if insert text includes property value
   */
  private static getInsertedTextForProperty(propertyNode: PropertyNode, includeValue: boolean): string {
    const name: string = propertyNode.name;
    if (!includeValue) {
      return `"${name}"`;
    }

    // provide value snippet according to property type
    let value = "$1";
    if (propertyNode.isPlural && propertyNode.type !== NodeType.RdfLangString) {
      value = "[$1]";
    } else if (propertyNode.type) {
      const typeClassNode: ClassNode|undefined = IntelliSenseUtility.getClassNodeByClassId(propertyNode.type);
      if (typeClassNode && DigitalTwinCompletionItemProvider.isObjectClass(typeClassNode)) {
        value = "{$1}";
      } else {
        let type: string|undefined = propertyNode.type;

        if (typeClassNode) {
          type = DigitalTwinCompletionItemProvider.tryGetUniqueTypeByTypeClassNode(typeClassNode);
        }

        switch (type) {
            case NodeType.Boolean:
            case NodeType.XsdBoolean:
              value = "${1:false}";
              break;
            case NodeType.Integer:
            case NodeType.XsdInteger:
              value = "${1:0}";
              break;
            case NodeType.String:
            case NodeType.XsdString:
            case NodeType.RdfLangString:
              value = '"$1"';
              break;
          }
      }
    }
    return `"${name}": ${value}`;
  }

  private static isObjectClass(typeClassNode: ClassNode): boolean {
    return (!typeClassNode.isAbstract && !typeClassNode.instances);
  }

  private static tryGetUniqueTypeByTypeClassNode(typeClassNode: ClassNode): string|undefined {
    if (!typeClassNode.isAbstract && typeClassNode.instances && typeClassNode.instances.length === 1) {
      return typeClassNode.instances[0];
    }
    return undefined;
  }

  private static suggestPropertiesCandidates(
    type: string,
    existedPropertyNames: string[],
    suggestWithValue: boolean,
    ): Suggestion[] {
    const suggestions: Suggestion[] = [];

    DigitalTwinCompletionItemProvider.
      suggestReservedProperties(type, existedPropertyNames, suggestWithValue, suggestions);
    DigitalTwinCompletionItemProvider.
      suggestUnreservedProperties(type, existedPropertyNames, suggestWithValue, suggestions);

    return suggestions;
  }

  private static suggestUnreservedProperties(
    type: string,
    existedPropertyNames: string[],
    suggestWithValue: boolean,
    suggestions: Suggestion[],
    ): void {
    const propertiesCandidates: Set<PropertyNode> =
      DigitalTwinCompletionItemProvider.getPropertiesCandidates(type, existedPropertyNames);
    for (const propertyCandidate of propertiesCandidates) {
      const isRequired: boolean = propertyCandidate.isRequired ? true : false;
      suggestions.push({
        isProperty: true,
        label: DigitalTwinCompletionItemProvider.formatLabel(propertyCandidate.name, isRequired),
        insertText: DigitalTwinCompletionItemProvider.getInsertedTextForProperty(propertyCandidate, suggestWithValue),
        withSeparator: suggestWithValue,
      });
    }
  }

  private static getPropertiesCandidates(type: string, existedPropertyNames: string[]): Set<PropertyNode> {
    const propertiesCandidates: Set<PropertyNode> = new Set<PropertyNode>();

    let typeClassNode: ClassNode|undefined = IntelliSenseUtility.getClassNodeByClassName(type);
    if (!typeClassNode) {
      // type is not a class name, it can be a property name
      typeClassNode = IntelliSenseUtility.getClassNodeByPropertyName(type);
    }

    if (typeClassNode && typeClassNode.properties) {
      for (const property of typeClassNode.properties) {
        const propertyNode: PropertyNode|undefined = IntelliSenseUtility.getPropertyNodeById(property);

        if (propertyNode && !existedPropertyNames.includes(propertyNode.name)) {
          propertiesCandidates.add(propertyNode);
        }
      }
    }
    return propertiesCandidates;
  }

  private static suggestReservedProperties(
    type: string,
    existedPropertyNames: string[],
    suggestWithValue: boolean,
    suggestions: Suggestion[],
    ): void {
    if (existedPropertyNames.includes(DigitalTwinConstants.ID)) {
      return;
    }

    // Suggest @id
    const isIdRequired: boolean = IntelliSenseUtility.isPartitionNode(type);
    const dummyIdNode: PropertyNode = {
      id: "dummy-id",
      name: DigitalTwinConstants.ID,
      nodeKind: Constants.EMPTY_STRING,
      type: Constants.EMPTY_STRING,
      constraint: {},
    };
    suggestions.push({
      isProperty: true,
      label: DigitalTwinCompletionItemProvider.formatLabel(dummyIdNode.name, isIdRequired),
      insertText: DigitalTwinCompletionItemProvider.getInsertedTextForProperty(dummyIdNode, suggestWithValue),
      withSeparator: suggestWithValue,
    });
  }

  /**
   * suggest completion item for property value
   * @param jsonPropertyNode json node
   * @param position position
   * @param range overwrite range
   * @param separator separator after completion text
   */
  private static suggestValue(jsonPropertyNode: parser.Node): Suggestion[] {
    const suggestions: Suggestion[] = [];
    if (!jsonPropertyNode.children || jsonPropertyNode.children.length < 1) {
      return suggestions;
    }

    const propertyObserveName = jsonPropertyNode.children[0].value as string;
    let possibleValues: string[];
    if (propertyObserveName === DigitalTwinConstants.TYPE) {
      possibleValues = DigitalTwinCompletionItemProvider.getPossibleTypeValues(jsonPropertyNode);
    } else {
      possibleValues =
        DigitalTwinCompletionItemProvider.getPossibleNonTypeValues(propertyObserveName, jsonPropertyNode);
    }

    for (const value of possibleValues) {
      suggestions.push({
        isProperty: false,
        label: value,
        insertText: `"${value}"`,
        withSeparator: true,
      });
    }

    return suggestions;
  }

  private static getPossibleTypeValues(jsonPropertyNode: parser.Node): string[] {
    const valueCandidates: string[] = [];

    const outerPropertyClassNode: ClassNode|undefined =
      IntelliSenseUtility.getOuterPropertyClassNode(jsonPropertyNode);

    if (!outerPropertyClassNode) {
      const entryNode = IntelliSenseUtility.getEntryNode();
      if (entryNode?.constraint.in) {
        valueCandidates.concat(entryNode?.constraint.in);
      }
      return valueCandidates;
    }

    if (outerPropertyClassNode.isAbstract) {
      if (outerPropertyClassNode.children) {
        for (const child of outerPropertyClassNode.children) {
          const childClassNode = IntelliSenseUtility.getClassNodeByClassId(child);
          if (childClassNode) {
            valueCandidates.push(childClassNode.name);
          }
        }
      }
    } else {
      valueCandidates.push(outerPropertyClassNode.name);
    }

    return valueCandidates;
  }

  private static getPossibleNonTypeValues(propertyObserveName: string, jsonPropertyNode: parser.Node): string[] {
    let valueCandidates: string[] = [];

    const propertyNode: PropertyNode|undefined =
      DigitalTwinCompletionItemProvider.getPropertyNodeByPropertyObserveName(propertyObserveName, jsonPropertyNode);
    if (!propertyNode) {
      return valueCandidates;
    }

    if (propertyNode.type) {
      valueCandidates =  DigitalTwinCompletionItemProvider.getAllInstancesOfClass(propertyNode.type);

      if (valueCandidates.length > 0 && propertyNode.constraint.in) {
        valueCandidates =
          DigitalTwinCompletionItemProvider.takeIntersectionOfInItems(valueCandidates, propertyNode.constraint.in);
      }
    }

    return valueCandidates;
  }

  private static getPropertyNodeByPropertyObserveName(
    propertyObserveName: string,
    jsonPropertyNode: parser.Node,
    ): PropertyNode|undefined {
    let propertyNode: PropertyNode|undefined;

    const propertyId: string|undefined = IntelliSenseUtility.getIdByName(propertyObserveName);
    if (propertyId) {
      propertyNode = IntelliSenseUtility.getPropertyNodeById(propertyId);
    } else {
      // property name is shared by multiple property.
      propertyNode =
        DigitalTwinCompletionItemProvider.getPropertyNodeByOuterProperty(jsonPropertyNode, propertyObserveName);
    }

    return propertyNode;
  }

  private static takeIntersectionOfInItems(instances: string[], inItems: string[]): string[] {
    const result: string[] = [];
    for (const possibleValue of inItems) {
      if (instances.includes(possibleValue)) {
        result.push(possibleValue);
      }
    }
    return result;
  }

  private static getPropertyNodeByOuterProperty(
    jsonPropertyNode: parser.Node,
    propertyObserveName: string,
    ): PropertyNode|undefined {
    const type = DigitalTwinCompletionItemProvider.tryGetType(jsonPropertyNode);
    if (!type) {
      return undefined;
    }

    const outerPropertyClassNode: ClassNode|undefined = IntelliSenseUtility.getClassNodeByClassName(type);
      // IntelliSenseUtility.getOuterPropertyClassNode(jsonPropertyNode);

    if (outerPropertyClassNode && outerPropertyClassNode.properties) {
      for (const propertyId of outerPropertyClassNode.properties) {
        const propertyNode: PropertyNode|undefined = IntelliSenseUtility.getPropertyNodeById(propertyId);
        if (propertyNode?.name === propertyObserveName) {
          return propertyNode;
        }
      }
    }
    return undefined;
  }

  private static getAllInstancesOfClass(className: string): string[]  {
    const instances: string[] = [];

    const classes: string[] = [];
    classes.push(className);

    while (classes.length > 0) {
      const classId = classes.values().next().value;
      // classes.delete(classId);

      const typeClassNode: ClassNode|undefined = IntelliSenseUtility.getClassNodeByClassId(classId);
      if (!typeClassNode) {
        continue;
      }

      if (typeClassNode.children) {
        for (const child of typeClassNode.children) {
          classes.push(child);
        }
      } else {
        if (typeClassNode.instances) {
          for (const instance of typeClassNode.instances) {
            instances.push(instance);
          }
        } else {
          instances.push(typeClassNode.name);
        }
      }

    }

    return instances;
  }

  /**
   * create completion item
   * @param label label
   * @param isProperty identify if kind is property
   * @param insertText insert text
   * @param position position
   * @param range overwrite range for completion text
   */
  private static createCompletionItem(
    suggestion: Suggestion,
    position: vscode.Position,
    range: vscode.Range,
    separator: string,
  ): vscode.CompletionItem {
    const insertTextTemp = suggestion.insertText + (suggestion.withSeparator ? separator : Constants.EMPTY_STRING);
    const completionItem: vscode.CompletionItem = {
      label: suggestion.label,
      kind: suggestion.isProperty ? vscode.CompletionItemKind.Property : vscode.CompletionItemKind.Value,
      insertText: new vscode.SnippetString(insertTextTemp),
      // the start of range should be after position, otherwise completion item will not be shown
      range: new vscode.Range(position, range.end),
    };
    if (position.isAfter(range.start)) {
      completionItem.additionalTextEdits = [vscode.TextEdit.delete(new vscode.Range(range.start, position))];
    }
    return completionItem;
  }

  /**
   * evaluate the overwrite range for completion text
   * @param document text document
   * @param position position
   * @param node json node
   */
  private static evaluateOverwriteRange(
    document: vscode.TextDocument,
    position: vscode.Position,
    node: parser.Node,
  ): vscode.Range {
    let range: vscode.Range;
    if (
      node.type === JsonNodeType.String ||
      node.type === JsonNodeType.Number ||
      node.type === JsonNodeType.Boolean
    ) {
      range = IntelliSenseUtility.getNodeRange(document, node);
    } else {
      const word: string = DigitalTwinCompletionItemProvider.getCurrentWord(
        document,
        position,
      );
      const start: number = document.offsetAt(position) - word.length;
      range = new vscode.Range(document.positionAt(start), position);
    }
    return range;
  }

  /**
   * get the current word before position
   * @param document text document
   * @param position position
   */
  private static getCurrentWord(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): string {
    let i: number = position.character - 1;
    const text: string = document.lineAt(position.line).text;
    while (
      i >= 0 &&
      DigitalTwinConstants.WORD_STOP.indexOf(text.charAt(i)) === -1
    ) {
      i--;
    }
    return text.slice(i + 1, position.character);
  }

  /**
   * evaluate the separator after offset
   * @param text text
   * @param offset offset
   */
  private static evaluateSeparatorAfter(text: string, offset: number): string {
    const scanner: parser.JSONScanner = parser.createScanner(text, true);
    scanner.setPosition(offset);
    const token: parser.SyntaxKind = scanner.scan();
    switch (token) {
      case parser.SyntaxKind.CommaToken:
      case parser.SyntaxKind.CloseBraceToken:
      case parser.SyntaxKind.CloseBracketToken:
      case parser.SyntaxKind.EOF:
        return Constants.EMPTY_STRING;
      default:
        return DigitalTwinConstants.DEFAULT_DELIMITER;
    }
  }

  private static getCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    stringNode: parser.Node,
    suggestions: Suggestion[],
    ): vscode.CompletionItem[] {
    const range: vscode.Range =
      DigitalTwinCompletionItemProvider.evaluateOverwriteRange(document, position, stringNode);
    const separator: string = DigitalTwinCompletionItemProvider.evaluateSeparatorAfter(
      document.getText(),
      document.offsetAt(range.end),
    );

    const completionItems: vscode.CompletionItem[] = suggestions.map((s) =>
      DigitalTwinCompletionItemProvider.createCompletionItem(s, position, range, separator),
    );
    return completionItems;
  }

  /**
   * format property label with required information
   * @param jsonPropertyKey label
   * @param required required properties
   */
  private static formatLabel(jsonPropertyKey: string, isRequired: boolean): string {
    const requiredInfo: string = isRequired ? ` ${DigitalTwinConstants.REQUIRED_PROPERTY_LABEL}` : "";
    return `${jsonPropertyKey}` + requiredInfo;
  }

  public provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
    const documentNode: parser.Node = DigitalTwinCompletionItemProvider.getDocumentNode(document, position);
    if (!IntelliSenseUtility.isDigitalTwinDefinition(documentNode)) {
      return undefined;
    }

    if (!IntelliSenseUtility.isGraphInitialized()) {
      return undefined;
    }

    const stringNode: parser.Node | undefined = parser.findNodeAtOffset(documentNode, document.offsetAt(position));
    if (!stringNode || stringNode.type !== JsonNodeType.String) {
      return undefined;
    }

    const suggestions: Suggestion[] = DigitalTwinCompletionItemProvider.getSuggestion(stringNode);

    return DigitalTwinCompletionItemProvider.getCompletionItems(document, position, stringNode, suggestions);
  }
}
