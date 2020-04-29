// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as parser from "jsonc-parser";
import * as vscode from "vscode";
import { Constants } from "../common/constants";
import { DigitalTwinConstants } from "./digitalTwinConstants";
import { ClassNode, Literal, NodeType, PropertyNode } from "./digitalTwinGraph";
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
  /**
   * get text for json parser after completion
   * @param document text document
   * @param position position
   */
  private static getTextForParse(document: vscode.TextDocument, position: vscode.Position): string {
    let text: string = document.getText();
    let textNode: parser.Node = parser.parseTree(text);
    if (textNode && textNode.type === JsonNodeType.Property) {
      const offset: number = document.offsetAt(position);
      text = DigitalTwinCompletionItemProvider.completeText(text, offset);
      textNode = parser.parseTree(text);
    }
    return text;
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

    const objectNode: parser.Node | undefined = jsonPropertyNode.parent;
    if (!objectNode || objectNode.type !== JsonNodeType.Object) {
      return [];
    }

    if (stringNode === jsonPropertyNode.children[0]) {
      const suggestWithValue: boolean = jsonPropertyNode.children.length < 2;
      return DigitalTwinCompletionItemProvider.suggestProperty(objectNode, suggestWithValue);
    } else {
      const propertyName: string = jsonPropertyNode.children[0].value;
      return DigitalTwinCompletionItemProvider.suggestValue(propertyName, objectNode);
    }
  }

  private static suggestProperty(
    objectNode: parser.Node,
    suggestWithValue: boolean,
  ): Suggestion[] {
    const existedProperties: string[] = DigitalTwinCompletionItemProvider.getExistedProperties(objectNode);

    const type = DigitalTwinCompletionItemProvider.tryGetType(objectNode);
    if (!type) {
      return DigitalTwinCompletionItemProvider.suggestTypeKey(suggestWithValue);
    } else {
      if (type === IntelliSenseUtility.resolveTypeName(Literal.LangString)) {
        return DigitalTwinCompletionItemProvider.suggestLanguageCode(existedProperties, suggestWithValue);
      }
      return DigitalTwinCompletionItemProvider.suggestPropertiesCandidates(type, existedProperties, suggestWithValue);
    }
  }

  private static suggestLanguageCode(existedPropertyNames: string[], suggestWithValue: boolean): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const dummyCodeNode: PropertyNode = {
      id: "dummy-language-code",
      name: Constants.EMPTY_STRING,
      nodeKind: Constants.EMPTY_STRING,
      type: NodeType.LangString,
      constraint: {},
    };
    for (const code of LANGUAGE_CODE) {
      if (existedPropertyNames.includes(code)) {
        continue;
      }
      dummyCodeNode.name = code;
      suggestions.push({
        isProperty: true,
        label: code,
        insertText: DigitalTwinCompletionItemProvider.getInsertedTextForProperty(dummyCodeNode, suggestWithValue),
        withSeparator: suggestWithValue,
      });
    }
    return suggestions;
  }

  private static getExistedProperties(objectNode: parser.Node): string[] {
    const existedProperties: string[] = [];
    if (!objectNode.children) {
      return existedProperties;
    }

    for (const child of objectNode.children) {
      if (child === objectNode) {
        continue;
      }

      const propertyPair: PropertyPair|undefined = IntelliSenseUtility.parseProperty(child);
      if (propertyPair) {
        const propertyName = propertyPair.name.value;
        existedProperties.push(propertyName);
      }
    }
    return existedProperties;
  }

  private static tryGetType(objectNode: parser.Node): string|undefined {
    const typeProperty: parser.Node|undefined =
      IntelliSenseUtility.getPropertyValueOfObjectByKey(DigitalTwinConstants.TYPE, objectNode);
    if (typeProperty) {
      return typeProperty.value;
    }

    return DigitalTwinCompletionItemProvider.tryGetTypeByOuterProperty(objectNode);
  }

  private static tryGetTypeByOuterProperty(objectNode: parser.Node): string|undefined {
    const outerPropertyPair: PropertyPair|undefined = IntelliSenseUtility.getOuterPropertyPair(objectNode);
    if (!outerPropertyPair) {
      return undefined;
    }

    const outerPropertyNode: PropertyNode|undefined = IntelliSenseUtility.getPropertyNode(outerPropertyPair.name.value);
    if (!outerPropertyNode) {
      return undefined;
    }

    const possibleClasses: ClassNode[] = IntelliSenseUtility.getObverseClasses(outerPropertyNode);
    if (possibleClasses && possibleClasses.length === 1) {
      return possibleClasses[0].name;
    }
    return undefined;
  }

  private static suggestTypeKey(suggestWithValue: boolean): Suggestion[] {
    const suggestions: Suggestion[] = [];

    const dummyTypeNode: PropertyNode = {
      id: "dummy-type",
      name: DigitalTwinConstants.TYPE,
      nodeKind: Constants.EMPTY_STRING,
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
    if (propertyNode.isPlural && !IntelliSenseUtility.isLanguageStringPropertyNode(propertyNode)) {
      value = "[$1]";
    } else if (propertyNode.type) {
      const typeClassNode: ClassNode|undefined = IntelliSenseUtility.getClassNode(propertyNode.type);
      if (typeClassNode && IntelliSenseUtility.isObverseClass(typeClassNode)
        && !IntelliSenseUtility.isLanguageString(typeClassNode)) {
        value = "{$1}";
      } else {
        const type: string = IntelliSenseUtility.resolveTypeName(propertyNode.type).toLowerCase();
        switch (type) {
            case NodeType.Boolean:
              value = "${1:false}";
              break;
            case NodeType.Integer:
              value = "${1:0}";
              break;
            case NodeType.String:
            case NodeType.LangString:
              value = '"$1"';
              break;
          }
      }
    }
    return `"${name}": ${value}`;
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

  private static suggestReservedProperties(
    type: string,
    existedPropertyNames: string[],
    suggestWithValue: boolean,
    suggestions: Suggestion[],
    ): void {
    const isPartitionClass: boolean = IntelliSenseUtility.isPartitionClass(type);

    if (!existedPropertyNames.includes(DigitalTwinConstants.ID)) {
      // Suggest @id
      const dummyIdNode: PropertyNode = {
          id: "dummy-id",
          name: DigitalTwinConstants.ID,
          nodeKind: Constants.EMPTY_STRING,
          constraint: {},
        };
      suggestions.push({
          isProperty: true,
          label: DigitalTwinCompletionItemProvider.formatLabel(dummyIdNode.name, isPartitionClass),
          insertText: DigitalTwinCompletionItemProvider.getInsertedTextForProperty(dummyIdNode, suggestWithValue),
          withSeparator: suggestWithValue,
        });
    }

    if (isPartitionClass && !existedPropertyNames.includes(DigitalTwinConstants.TYPE)) {
      // Suggest @type
      const typeSuggestion = DigitalTwinCompletionItemProvider.suggestTypeKey(suggestWithValue);
      suggestions.push(...typeSuggestion);
    }
  }

  private static suggestUnreservedProperties(
    type: string,
    existedPropertyNames: string[],
    suggestWithValue: boolean,
    suggestions: Suggestion[],
    ): void {
    const propertiesCandidates: PropertyNode[] =
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

  private static getPropertiesCandidates(type: string, existedPropertyNames: string[]): PropertyNode[] {
    const typeClassNode: ClassNode|undefined = IntelliSenseUtility.getClassNode(type);
    if (!typeClassNode) {
      return [];
    }

    const propertiesCandidates: PropertyNode[] = [];
    for (const property of IntelliSenseUtility.getPropertiesOfClassNode(typeClassNode)) {
      if (!existedPropertyNames.includes(property.name)) {
        propertiesCandidates.push(property);
      }
    }

    return propertiesCandidates;
  }

  /**
   * suggest completion item for property value
   * @param jsonPropertyNode json node
   * @param position position
   * @param range overwrite range
   * @param separator separator after completion text
   */
  private static suggestValue(propertyName: string, objectNode: parser.Node): Suggestion[] {
    const suggestions: Suggestion[] = [];

    let possibleValues: string[];
    if (propertyName === DigitalTwinConstants.TYPE) {
      possibleValues = DigitalTwinCompletionItemProvider.getPossibleTypeValues(objectNode);
    } else {
      possibleValues =
        DigitalTwinCompletionItemProvider.getPossibleNonTypeValues(propertyName, objectNode);
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

  private static getPossibleTypeValues(objectNode: parser.Node): string[] {
    const valueCandidates: string[] = [];

    const outerPropertyPair: PropertyPair|undefined = IntelliSenseUtility.getOuterPropertyPair(objectNode);
    if (!outerPropertyPair) {
      const partitionClasses: string[]|undefined = IntelliSenseUtility.getEntryNode()?.constraint.in;
      if (partitionClasses) {
        for (const partitionClassId of partitionClasses) {
          valueCandidates.push(IntelliSenseUtility.resolveNodeName(partitionClassId));
        }
      }
      return valueCandidates;
    }

    const parentObject: parser.Node|undefined = outerPropertyPair.value.parent?.parent;
    if (!parentObject || parentObject.type !== JsonNodeType.Object) {
      return valueCandidates;
    }
    const outerPropertyNode: PropertyNode|undefined =
      DigitalTwinCompletionItemProvider.getPropertyNodeByPropertyName(outerPropertyPair.name.value, parentObject);
    if (!outerPropertyNode) {
      return valueCandidates;
    }
    const possibleClasses: ClassNode[] = IntelliSenseUtility.getObverseClasses(outerPropertyNode);
    for (const classNode of possibleClasses) {
      valueCandidates.push(classNode.name);
    }

    return valueCandidates;
  }

  private static getPossibleNonTypeValues(propertyName: string, objectNode: parser.Node): string[] {
    const valueCandidates: string[] = [];

    const propertyNode: PropertyNode|undefined =
      DigitalTwinCompletionItemProvider.getPropertyNodeByPropertyName(propertyName, objectNode);

    if (propertyNode?.constraint.in) {
        for (const instance of propertyNode.constraint.in) {
          valueCandidates.push(IntelliSenseUtility.resolveNodeName(instance));
        }
        return valueCandidates;
    }

    if (propertyNode?.type) {
      const typeClassNode: ClassNode|undefined = IntelliSenseUtility.getClassNode(propertyNode.type);
      if (typeClassNode) {
        return IntelliSenseUtility.getInstancesOfClassNode(typeClassNode);
      }
    }

    return valueCandidates;
  }

  private static getPropertyNodeByPropertyName(
    propertyName: string,
    objectNode: parser.Node,
    ): PropertyNode|undefined {
    let propertyNode: PropertyNode|undefined = IntelliSenseUtility.getPropertyNode(propertyName);

    if (!propertyNode) {
      // property name is shared by multiple property.
      propertyNode = DigitalTwinCompletionItemProvider.getPropertyNodeByOuterProperty(objectNode, propertyName);
    }

    return propertyNode;
  }

  private static getPropertyNodeByOuterProperty(
    objectNode: parser.Node,
    propertyName: string,
    ): PropertyNode|undefined {
    const type = DigitalTwinCompletionItemProvider.tryGetType(objectNode);
    if (!type) {
      return undefined;
    }

    const outerPropertyClassNode: ClassNode|undefined = IntelliSenseUtility.getClassNode(type);

    if (outerPropertyClassNode && outerPropertyClassNode.properties) {
      for (const propertyId of outerPropertyClassNode.properties) {
        const propertyNode: PropertyNode|undefined = IntelliSenseUtility.getPropertyNode(propertyId);
        if (propertyNode?.name === propertyName) {
          return propertyNode;
        }
      }
    }
    return undefined;
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
    const text: string = DigitalTwinCompletionItemProvider.getTextForParse(document, position);
    const modelContent: ModelContent | undefined = IntelliSenseUtility.parseDigitalTwinModel(text);
    if (!modelContent) {
      return undefined;
    }
    if (!IntelliSenseUtility.isGraphInitialized()) {
      return undefined;
    }

    const stringNode: parser.Node | undefined =
      parser.findNodeAtOffset(modelContent.jsonNode, document.offsetAt(position));
    if (!stringNode || stringNode.type !== JsonNodeType.String) {
      return undefined;
    }

    const suggestions: Suggestion[] = DigitalTwinCompletionItemProvider.getSuggestion(stringNode);

    return DigitalTwinCompletionItemProvider.getCompletionItems(document, position, stringNode, suggestions);
  }
}
