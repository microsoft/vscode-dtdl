// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as parser from "jsonc-parser";
import * as vscode from "vscode";
import { Constants } from "../common/constants";
import { DigitalTwinConstants } from "./digitalTwinConstants";
import { ClassNode, Literal, PropertyNode } from "./digitalTwinGraph";
import { IntelliSenseUtility, JsonNodeType, ModelContent, PropertyPair } from "./intelliSenseUtility";
import { LANGUAGE_CODE } from "./languageCode";

interface Suggestion {
  isProperty: boolean;
  label: string;
  insertText: string;
  includeSeparator: boolean;
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
    const textNode: parser.Node = parser.parseTree(text);
    if (textNode && textNode.type === JsonNodeType.Property) {
      const offset: number = document.offsetAt(position);
      text = DigitalTwinCompletionItemProvider.completeText(text, offset);
    }
    return text;
  }

  private static completeText(text: string, offset: number): string {
    if (text[offset] === Constants.COMPLETION_TRIGGER) {
      const edit: parser.Edit = {
        offset,
        length: 1,
        content: Constants.COMPLETION_TRIGGER + DigitalTwinConstants.DEFAULT_DELIMITER,
      };
      text = parser.applyEdits(text, [edit]);
    }
    return text;
  }

  private static getSuggestion(stringNode: parser.Node): Suggestion[] {
    const suggestions: Suggestion[] = [];

    const jsonPropertyNode: parser.Node | undefined = stringNode.parent;
    if (!jsonPropertyNode || jsonPropertyNode.type !== JsonNodeType.Property || !jsonPropertyNode.children) {
      return suggestions;
    }

    const objectNode: parser.Node | undefined = jsonPropertyNode.parent;
    if (!objectNode || objectNode.type !== JsonNodeType.Object) {
      return suggestions;
    }

    if (stringNode === jsonPropertyNode.children[0]) {
      const suggestWithValue: boolean = jsonPropertyNode.children.length < 2;
      DigitalTwinCompletionItemProvider.suggestProperty(objectNode, suggestWithValue, suggestions);
    } else {
      const propertyName: string = jsonPropertyNode.children[0].value;
      DigitalTwinCompletionItemProvider.suggestValue(propertyName, objectNode, suggestions);
    }
    return suggestions;
  }

  private static suggestProperty(
    objectNode: parser.Node,
    suggestWithValue: boolean,
    suggestions: Suggestion[],
  ): void {
    const existingProperties: Set<string> = DigitalTwinCompletionItemProvider.getExistingProperties(objectNode);

    const typeClassNode: ClassNode|undefined = DigitalTwinCompletionItemProvider.getObjectTypeClassNode(objectNode);
    if (!typeClassNode) {
      return DigitalTwinCompletionItemProvider.AddTypePropertySuggestion(
        existingProperties, true, suggestWithValue, suggestions);
    } else {
      if (IntelliSenseUtility.isLanguageString(typeClassNode)) {
        return DigitalTwinCompletionItemProvider.AddLanguageCodePropertySuggestion(
          existingProperties, suggestWithValue, suggestions);
      }
      return DigitalTwinCompletionItemProvider.
        suggestPropertiesCandidates(typeClassNode, existingProperties, suggestWithValue, suggestions);
    }
  }

  private static AddLanguageCodePropertySuggestion(
    existingPropertyNames: Set<string>,
    suggestWithValue: boolean,
    suggestions: Suggestion[],
    ): void {
    for (const code of LANGUAGE_CODE) {
      if (existingPropertyNames.has(code)) {
        continue;
      }
      const dummyLanguageCodeNode: PropertyNode = {
        id: DigitalTwinConstants.DUMMY,
        name: code,
        type: Literal.String,
        nodeKind: DigitalTwinConstants.LITERAL,
        constraint: {},
      };
      DigitalTwinCompletionItemProvider.AddPropertySuggestion(
        dummyLanguageCodeNode, false, suggestWithValue, suggestions);
    }
  }

  private static getExistingProperties(objectNode: parser.Node): Set<string> {
    const existingProperties: Set<string> = new Set<string>();
    if (!objectNode.children) {
      return existingProperties;
    }

    for (const child of objectNode.children) {
      if (child === objectNode) {
        continue;
      }

      const propertyPair: PropertyPair|undefined = IntelliSenseUtility.parseProperty(child);
      if (propertyPair) {
        const propertyName = propertyPair.name.value;
        existingProperties.add(propertyName);
      }
    }
    return existingProperties;
  }

  private static getObjectTypeClassNode(objectNode: parser.Node): ClassNode|undefined {
    const typeProperty: parser.Node|undefined =
      IntelliSenseUtility.getPropertyValueOfObjectByKey(DigitalTwinConstants.TYPE, objectNode);
    if (typeProperty) {
      return IntelliSenseUtility.getClassNode(typeProperty.value);
    }

    return DigitalTwinCompletionItemProvider.getObjectTypeByOuterProperty(objectNode);
  }

  private static getObjectTypeByOuterProperty(objectNode: parser.Node): ClassNode|undefined {
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
      return possibleClasses[0];
    }
    return undefined;
  }

  private static AddPropertySuggestion(
    propertyNode: PropertyNode,
    isRequired: boolean,
    suggestWithValue: boolean,
    suggestions: Suggestion[],
    ): void {
    suggestions.push({
      isProperty: true,
      label: DigitalTwinCompletionItemProvider.formatLabel(propertyNode.name, isRequired),
      insertText: DigitalTwinCompletionItemProvider.getInsertedTextForProperty(propertyNode, suggestWithValue),
      includeSeparator: suggestWithValue,
    });
  }

  private static AddTypePropertySuggestion(
    existingPropertyNames: Set<string>,
    isRequired: boolean,
    suggestWithValue: boolean,
    suggestions: Suggestion[],
    ): void {
    if (existingPropertyNames.has(DigitalTwinConstants.TYPE)) {
      return;
    }
    const dummyTypeNode: PropertyNode = {
      id: DigitalTwinConstants.DUMMY,
      name: DigitalTwinConstants.TYPE,
      type: Constants.EMPTY_STRING,
      nodeKind: DigitalTwinConstants.LITERAL,
      constraint: {},
    };
    DigitalTwinCompletionItemProvider.AddPropertySuggestion(dummyTypeNode, isRequired, suggestWithValue, suggestions);
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
    if (!propertyNode.type) {
      return `"${name}": ${value}`;
    }

    if (propertyNode.nodeKind === DigitalTwinConstants.LITERAL) {
      switch (propertyNode.type) {
          case Literal.Boolean:
            value = "${1:false}";
            break;
          case Literal.Integer:
            value = "${1:0}";
            break;
          case Literal.String:
          case Literal.LangString:
            value = '"$1"';
            break;
        }
    } else if (propertyNode.isPlural) {
      value = "[$1]";
    } else {
      const typeClassNode: ClassNode|undefined = IntelliSenseUtility.getClassNode(propertyNode.type);
      if (typeClassNode && IntelliSenseUtility.isObverseClass(typeClassNode)) {
        value = "{$1}";
      }
    }

    return `"${name}": ${value}`;
  }

  private static suggestPropertiesCandidates(
    typeClassNode: ClassNode,
    existingPropertyNames: Set<string>,
    suggestWithValue: boolean,
    suggestions: Suggestion[],
    ): void {
    DigitalTwinCompletionItemProvider.
      suggestReservedProperties(typeClassNode, existingPropertyNames, suggestWithValue, suggestions);
    DigitalTwinCompletionItemProvider.
      suggestUnreservedProperties(typeClassNode, existingPropertyNames, suggestWithValue, suggestions);
  }

  private static suggestReservedProperties(
    typeClassNode: ClassNode,
    existingPropertyNames: Set<string>,
    suggestWithValue: boolean,
    suggestions: Suggestion[],
    ): void {
    const isPartitionClass: boolean = IntelliSenseUtility.isPartitionClass(typeClassNode.name);

    if (!existingPropertyNames.has(DigitalTwinConstants.ID)) {
      // Suggest @id
    const dummyIdNode: PropertyNode = {
      id: DigitalTwinConstants.DUMMY,
      name: DigitalTwinConstants.ID,
      type: Literal.String,
      nodeKind: DigitalTwinConstants.LITERAL,
      constraint: {},
    };
    DigitalTwinCompletionItemProvider.AddPropertySuggestion(
      dummyIdNode, isPartitionClass, suggestWithValue, suggestions);
    }

    // Suggest @type
    DigitalTwinCompletionItemProvider.AddTypePropertySuggestion(
      existingPropertyNames, isPartitionClass, suggestWithValue, suggestions);
  }

  private static suggestUnreservedProperties(
    typeClassNode: ClassNode,
    existingPropertyNames: Set<string>,
    suggestWithValue: boolean,
    suggestions: Suggestion[],
    ): void {
    const propertiesCandidates: PropertyNode[] =
      DigitalTwinCompletionItemProvider.getPropertiesCandidates(typeClassNode, existingPropertyNames);
    for (const propertyCandidate of propertiesCandidates) {
      DigitalTwinCompletionItemProvider.AddPropertySuggestion(
        propertyCandidate, (Boolean)(propertyCandidate.isRequired), suggestWithValue, suggestions);
    }
  }

  private static getPropertiesCandidates(typeClassNode: ClassNode, existingPropertyNames: Set<string>): PropertyNode[] {
    const propertiesCandidates: PropertyNode[] = [];
    for (const property of IntelliSenseUtility.getPropertiesOfClassNode(typeClassNode)) {
      if (!existingPropertyNames.has(property.name)) {
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
  private static suggestValue(propertyName: string, objectNode: parser.Node, suggestions: Suggestion[]): void {
    let possibleValues: string[];
    if (propertyName === DigitalTwinConstants.TYPE) {
      possibleValues = DigitalTwinCompletionItemProvider.suggestTypeValues(objectNode);
    } else {
      possibleValues =
        DigitalTwinCompletionItemProvider.suggestNonTypeValues(propertyName, objectNode);
    }

    for (const value of possibleValues) {
      suggestions.push({
        isProperty: false,
        label: value,
        insertText: `"${value}"`,
        includeSeparator: true,
      });
    }
  }

  private static suggestTypeValues(objectNode: parser.Node): string[] {
    const outerPropertyPair: PropertyPair|undefined = IntelliSenseUtility.getOuterPropertyPair(objectNode);
    let outerPropertyNode: PropertyNode|undefined;
    if (!outerPropertyPair) {
      outerPropertyNode = IntelliSenseUtility.getEntryNode();
    } else {
      const outerPropertyObjectNode: parser.Node|undefined = outerPropertyPair.value.parent?.parent;
      if (!outerPropertyObjectNode || outerPropertyObjectNode.type !== JsonNodeType.Object) {
        return [];
      }
      outerPropertyNode = DigitalTwinCompletionItemProvider.
        getPropertyNodeByPropertyName(outerPropertyPair.name.value, outerPropertyObjectNode);
    }

    if (!outerPropertyNode) {
      return [];
    }

    const valueCandidates: string[] = [];
    const possibleClasses: ClassNode[] = IntelliSenseUtility.getObverseClasses(outerPropertyNode);
    for (const classNode of possibleClasses) {
      valueCandidates.push(classNode.name);
    }
    return valueCandidates;
  }

  private static suggestNonTypeValues(propertyName: string, objectNode: parser.Node): string[] {
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
    const outerPropertyClassNode: ClassNode|undefined =
      DigitalTwinCompletionItemProvider.getObjectTypeClassNode(objectNode);
    if (outerPropertyClassNode) {
      const properties: PropertyNode[] = IntelliSenseUtility.getPropertiesOfClassNode(outerPropertyClassNode);
      for (const property of properties) {
        if (property.name === propertyName) {
          return property;
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
    const insertTextTemp = suggestion.insertText + (suggestion.includeSeparator ? separator : Constants.EMPTY_STRING);
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
    if (!IntelliSenseUtility.isGraphInitialized()) {
      return undefined;
    }

    const text: string = DigitalTwinCompletionItemProvider.getTextForParse(document, position);
    const modelContent: ModelContent | undefined = IntelliSenseUtility.parseDigitalTwinModel(text);
    if (!modelContent) {
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
