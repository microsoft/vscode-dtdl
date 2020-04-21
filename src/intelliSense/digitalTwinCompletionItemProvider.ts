// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as parser from "jsonc-parser";
import * as vscode from "vscode";
import { Constants } from "../common/constants";
import { DigitalTwinConstants } from "./digitalTwinConstants";
import { ClassNode, DigitalTwinGraph, PropertyNode } from "./digitalTwinGraph";
import { IntelliSenseUtility, JsonNodeType, PropertyPair } from "./intelliSenseUtility";
import { LANGUAGE_CODE } from "./languageCode";

/**
 * Completion item provider for DigitalTwin IntelliSense
 */
export class DigitalTwinCompletionItemProvider implements vscode.CompletionItemProvider {
  /**
   * get text for json parser after completion
   * @param document text document
   * @param position position
   */
  private static getTextForParse(document: vscode.TextDocument, position: vscode.Position): string {
    const text: string = document.getText();
    const offset: number = document.offsetAt(position);
    if (text[offset] === Constants.COMPLETION_TRIGGER) {
      const edit: parser.Edit = {
        offset,
        length: 1,
        content: Constants.COMPLETION_TRIGGER + Constants.DEFAULT_SEPARATOR,
      };
      return parser.applyEdits(text, [edit]);
    }
    return text;
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
    label: string,
    isProperty: boolean,
    insertText: string,
    position: vscode.Position,
    range: vscode.Range,
  ): vscode.CompletionItem {
    const completionItem: vscode.CompletionItem = {
      label,
      kind: isProperty ? vscode.CompletionItemKind.Property : vscode.CompletionItemKind.Value,
      insertText: new vscode.SnippetString(insertText),
      // the start of range should not be before position, otherwise completion item will not be shown
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
    if (node.type === JsonNodeType.String || node.type === JsonNodeType.Number || node.type === JsonNodeType.Boolean) {
      range = IntelliSenseUtility.getNodeRange(document, node);
    } else {
      const word: string = DigitalTwinCompletionItemProvider.getCurrentWord(document, position);
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
  private static getCurrentWord(document: vscode.TextDocument, position: vscode.Position): string {
    let i: number = position.character - 1;
    const text: string = document.lineAt(position.line).text;
    while (i >= 0 && DigitalTwinConstants.WORD_STOP.indexOf(text.charAt(i)) === -1) {
      i--;
    }
    return text.substring(i + 1, position.character);
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
        return Constants.DEFAULT_SEPARATOR;
    }
  }

  /**
   * suggest completion item for property
   * @param node json node
   * @param position position
   * @param range overwrite range
   * @param includeValue identifiy if includes property value
   * @param separator separator after completion text
   */
  private static suggestProperty(
    node: parser.Node,
    position: vscode.Position,
    range: vscode.Range,
    includeValue: boolean,
    separator: string,
  ): vscode.CompletionItem[] {
    const completionItems: vscode.CompletionItem[] = [];
    return completionItems;
  }

  /**
   * get the type of json object node and record existing properties
   * @param node json node
   * @param exist existing properties
   */
  private static getObjectType(node: parser.Node, exist: Set<string>): ClassNode | undefined {
    const parent: parser.Node | undefined = node.parent;
    if (!parent || parent.type !== JsonNodeType.Object || !parent.children) {
      return undefined;
    }
    let propertyName: string;
    let objectType: ClassNode | undefined;
    let propertyPair: PropertyPair | undefined;
    for (const child of parent.children) {
      if (child === node) {
        continue;
      }
      propertyPair = IntelliSenseUtility.parseProperty(child);
      if (!propertyPair || !propertyPair.name.value) {
        continue;
      }
      propertyName = propertyPair.name.value as string;
      exist.add(propertyName);
      // get from @type property
      if (propertyName === DigitalTwinConstants.TYPE) {
        const propertyValue: parser.Node = propertyPair.value;
        if (propertyValue.type === JsonNodeType.String) {
        } else if (propertyValue.type === JsonNodeType.Array && propertyValue.children) {
          // support semantic type array
          for (const element of propertyValue.children) {
            if (element.type === JsonNodeType.String) {
              const type: string = element.value as string;
              if (type && DigitalTwinConstants.SUPPORT_SEMANTIC_TYPES.has(type)) {
              }
            }
          }
        }
      }
    }
    // infer from outer property
    if (!objectType) {
      const propertyNode: PropertyNode | undefined = DigitalTwinCompletionItemProvider.getOuterPropertyNode(parent);
      if (propertyNode) {
        const classes: ClassNode[] = [];
        if (classes.length === 1) {
          objectType = classes[0];
        }
      }
    }
    return objectType;
  }

  /**
   * get outer DigitalTwin property node from current node
   * @param node json node
   */
  private static getOuterPropertyNode(node: parser.Node): PropertyNode | undefined {
    const propertyPair: PropertyPair | undefined = IntelliSenseUtility.getOuterPropertyPair(node);
    if (!propertyPair) {
      return undefined;
    }
    const propertyName: string = IntelliSenseUtility.resolvePropertyName(propertyPair);
    return undefined;
  }

  /**
   * format property label with required information
   * @param label label
   * @param required required properties
   */
  private static formatLabel(label: string, required: Set<string>): string {
    return required.has(label) ? `${label} ${DigitalTwinConstants.REQUIRED_PROPERTY_LABEL}` : label;
  }

  /**
   * suggest completion item for property value
   * @param node json node
   * @param position position
   * @param range overwrite range
   * @param separator separator after completion text
   */
  private static suggestValue(
    node: parser.Node,
    position: vscode.Position,
    range: vscode.Range,
    separator: string,
  ): vscode.CompletionItem[] {
    const completionItems: vscode.CompletionItem[] = [];
    return completionItems;
  }

  /**
   * provide completion items
   * @param document text document
   * @param position position
   * @param token cancellation token
   * @param context completion context
   */
  public provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext,
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
    const text: string = DigitalTwinCompletionItemProvider.getTextForParse(document, position);
    const jsonNode: parser.Node | undefined = IntelliSenseUtility.parseDigitalTwinModel(text);
    if (!jsonNode) {
      return undefined;
    }
    if (!IntelliSenseUtility.isGraphInitialized()) {
      return undefined;
    }
    const node: parser.Node | undefined = parser.findNodeAtOffset(jsonNode, document.offsetAt(position));
    if (!node || node.type !== JsonNodeType.String) {
      return undefined;
    }
    const range: vscode.Range = DigitalTwinCompletionItemProvider.evaluateOverwriteRange(document, position, node);
    const separator: string = DigitalTwinCompletionItemProvider.evaluateSeparatorAfter(
      document.getText(),
      document.offsetAt(range.end),
    );
    const parent: parser.Node | undefined = node.parent;
    if (!parent || parent.type !== JsonNodeType.Property || !parent.children) {
      return undefined;
    }
    if (node === parent.children[0]) {
      const includeValue: boolean = parent.children.length < 2;
      return DigitalTwinCompletionItemProvider.suggestProperty(parent, position, range, includeValue, separator);
    } else {
      return DigitalTwinCompletionItemProvider.suggestValue(parent, position, range, separator);
    }
  }
}
