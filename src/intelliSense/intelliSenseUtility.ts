// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as parser from "jsonc-parser";
import * as vscode from "vscode";
import { DigitalTwinConstants } from "./digitalTwinConstants";
import { ClassNode, DigitalTwinGraph, PropertyNode } from "./digitalTwinGraph";

/**
 * Type of json node
 */
export enum JsonNodeType {
  Object = "object",
  Array = "array",
  String = "string",
  Number = "number",
  Boolean = "boolean",
  Property = "property",
}

/**
 * Property pair includes name and value
 */
export interface PropertyPair {
  name: parser.Node;
  value: parser.Node;
}

/**
 * Utility for IntelliSense
 */
export class IntelliSenseUtility {
  /**
   * init DigitalTwin graph
   * @param context extension context
   */
  public static async initGraph(context: vscode.ExtensionContext): Promise<void> {
    IntelliSenseUtility.graph = await DigitalTwinGraph.getInstance(context);
  }

  /**
   * check if IntelliSense has been enabled
   */
  public static enabled(): boolean {
    return IntelliSenseUtility.graph && IntelliSenseUtility.graph.initialized();
  }

  /**
   * parse the text, return json node if it is DigitalTwin model
   * @param text text
   */
  public static parseDigitalTwinModel(text: string): parser.Node | undefined {
    // skip checking errors in order to do IntelliSense at best effort
    const jsonNode: parser.Node = parser.parseTree(text);
    const contextPath: string[] = [DigitalTwinConstants.CONTEXT];
    const contextNode: parser.Node | undefined = parser.findNodeAtLocation(jsonNode, contextPath);
    if (contextNode && IntelliSenseUtility.isDigitalTwinContext(contextNode)) {
      return jsonNode;
    }
    return undefined;
  }

  /**
   * check if json node has DigitalTwin context
   * @param node json node
   */
  public static isDigitalTwinContext(node: parser.Node): boolean {
    // @context accept both array and string
    if (node.type === JsonNodeType.String) {
      return (node.value as string) === DigitalTwinConstants.CONTEXT_TEMPLATE;
    } else if (node.type === JsonNodeType.Array && node.children) {
      for (const child of node.children) {
        if (child.type === JsonNodeType.String && (child.value as string) === DigitalTwinConstants.CONTEXT_TEMPLATE) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * parse json node, return property pair
   * @param node json node
   */
  public static parseProperty(node: parser.Node): PropertyPair | undefined {
    if (node.type !== JsonNodeType.Property || !node.children || node.children.length !== 2) {
      return undefined;
    }
    return { name: node.children[0], value: node.children[1] };
  }

  /**
   * get the range of json node
   * @param document text document
   * @param node json node
   */
  public static getNodeRange(document: vscode.TextDocument, node: parser.Node): vscode.Range {
    return new vscode.Range(document.positionAt(node.offset), document.positionAt(node.offset + node.length));
  }

  /**
   * resolve property name for schema and interfaceSchema
   * @param propertyPair property pair
   */
  public static resolvePropertyName(propertyPair: PropertyPair): string {
    let propertyName: string = propertyPair.name.value as string;
    if (propertyName !== DigitalTwinConstants.SCHEMA) {
      return propertyName;
    }
    let node: parser.Node = propertyPair.name;
    // get outer object node
    if (node.parent && node.parent.parent) {
      node = node.parent.parent;
      const outPropertyPair: PropertyPair | undefined = IntelliSenseUtility.getOuterPropertyPair(node);
      if (outPropertyPair) {
        const name: string = outPropertyPair.name.value as string;
        if (name === DigitalTwinConstants.IMPLEMENTS) {
          propertyName = DigitalTwinConstants.INTERFACE_SCHEMA;
        }
      }
    }
    return propertyName;
  }

  /**
   * get outer property pair from current node
   * @param node json node
   */
  public static getOuterPropertyPair(node: parser.Node): PropertyPair | undefined {
    if (node.type !== JsonNodeType.Object) {
      return undefined;
    }
    let outerProperty: parser.Node | undefined = node.parent;
    if (outerProperty && outerProperty.type === JsonNodeType.Array) {
      outerProperty = outerProperty.parent;
    }
    return outerProperty ? IntelliSenseUtility.parseProperty(outerProperty) : undefined;
  }

  /**
   * check if document is a DigitalTwin file
   * @param document text document
   */
  public static isDigitalTwinFile(document: vscode.TextDocument): boolean {
    return document.languageId === DigitalTwinConstants.LANGUAGE_ID;
  }

  private static graph: DigitalTwinGraph;
  private constructor() {}
}
