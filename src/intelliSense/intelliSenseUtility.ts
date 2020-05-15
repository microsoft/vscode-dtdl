// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as parser from "jsonc-parser";
import * as vscode from "vscode";
import { Constants } from "../common/constants";
import { DigitalTwinConstants } from "./digitalTwinConstants";
import { ClassNode, DigitalTwinGraph, Literal, PropertyNode } from "./digitalTwinGraph";

/**
 * Type kind of json node
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
 * DigitalTwin model content
 */
export interface ModelContent {
  jsonNode: parser.Node;
  version: number;
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
   * check if DigitalTwin graph is initialized
   */
  public static isGraphInitialized(): boolean {
    return IntelliSenseUtility.graph && IntelliSenseUtility.graph.initialized();
  }

  /**
   * check if class is partition
   * @param name class name
   */
  public static isPartitionClass(name: string): boolean {
    return IntelliSenseUtility.graph.isPartitionClass(name);
  }

  public static isObjectClass(classNode: ClassNode): boolean {
    return !classNode.isAbstract && !classNode.instances;
  }

  /**
   * get entry node of DigitalTwin graph
   */
  public static getEntryNode(): PropertyNode | undefined {
    return IntelliSenseUtility.graph.getPropertyNode(DigitalTwinConstants.ENTRY);
  }

  /**
   * get property node by name or id
   * @param nameOrId property name or id
   */
  public static getPropertyNode(nameOrId: string): PropertyNode | undefined {
    return IntelliSenseUtility.graph.getPropertyNode(nameOrId);
  }

  /**
   * get class node by name or id
   * @param nameOrId class name or id
   */
  public static getClassNode(nameOrId: string): ClassNode | undefined {
    return IntelliSenseUtility.graph.getClassNode(nameOrId);
  }

  /**
   * get properties of class node
   * @param classNode class node
   */
  public static getPropertiesOfClassNode(classNode: ClassNode): PropertyNode[] {
    return IntelliSenseUtility.graph.getPropertiesOfClassNode(classNode);
  }

  /**
   * get instances of class node
   * @param classNode class node
   */
  public static getInstancesOfClassNode(classNode: ClassNode): string[] {
    if (classNode.instances) {
      // copy to a new array
      return [...classNode.instances];
    }
    if (classNode.isAbstract) {
      return IntelliSenseUtility.graph.getInstancesOfAbstractClass(classNode);
    }
    return [];
  }

  /**
   * get object class collection, including language string
   * @param propertyNode property node
   */
  public static getObjectClasses(propertyNode: PropertyNode): ClassNode[] {
    let classes: ClassNode[] = [];
    let classNode: ClassNode | undefined;
    // constraint is prior to type, e.g. entry node
    if (propertyNode.constraint.in) {
      for (const id of propertyNode.constraint.in) {
        classNode = IntelliSenseUtility.getClassNode(id);
        if (classNode) {
          classes.push(classNode);
        }
      }
      return classes;
    }

    if (!propertyNode.type) {
      return classes;
    }

    classNode = IntelliSenseUtility.getClassNode(propertyNode.type);
    if (!classNode || classNode.instances) {
      return classes;
    }

    if (classNode.isAbstract) {
      classes = IntelliSenseUtility.graph.getObverseChildrenOfAbstractClass(classNode);
    } else {
      // obverse class or language string
      classes.push(classNode);
    }

    // remove exclude class
    if (propertyNode.constraint.exclude && propertyNode.constraint.exclude.length) {
      const excludeSet = new Set<string>(propertyNode.constraint.exclude);
      classes = classes.filter((classItem: ClassNode) => !excludeSet.has(classItem.id));
    }
    return classes;
  }

  /**
   * resolve node name from dtmi id
   * @param id dtmi id
   */
  public static resolveNodeName(id: string): string {
    const start: number = id.lastIndexOf(DigitalTwinConstants.DTMI_PATH_DELIMITER);
    const end: number = id.lastIndexOf(DigitalTwinConstants.DTMI_VERSION_DELIMITER);
    if (start !== -1 && end !== -1) {
      return id.slice(start + 1, end);
    }
    return Constants.EMPTY_STRING;
  }

  /**
   * resolve type name
   * @param type type of property node
   */
  public static resolveTypeName(type: string): string {
    const classNode: ClassNode | undefined = IntelliSenseUtility.getClassNode(type);
    if (classNode) {
      return classNode.name;
    }
    // get XMLSchema name
    const index: number = type.lastIndexOf(DigitalTwinConstants.SCHEMA_DELIMITER);
    return index === -1 ? type : type.slice(index + 1);
  }

  /**
   * check if document is a DigitalTwin file
   * @param document text document
   */
  public static isDigitalTwinFile(document: vscode.TextDocument): boolean {
    return document.languageId === DigitalTwinConstants.LANGUAGE_ID;
  }

  /**
   * check if class node is a language string
   * @param classNode class node
   */
  public static isLanguageString(classNode: ClassNode): boolean {
    return classNode.id === Literal.LangString;
  }

  /**
   * parse the text, return DigitalTwin model content
   * @param text text
   */
  public static parseDigitalTwinModel(text: string): ModelContent | undefined {
    // skip checking errors in order to do IntelliSense at best effort
    const jsonNode: parser.Node = parser.parseTree(text);
    const contextPath: string[] = [DigitalTwinConstants.CONTEXT];
    const contextNode: parser.Node | undefined = parser.findNodeAtLocation(jsonNode, contextPath);
    if (!contextNode) {
      return undefined;
    }
    const version: number = IntelliSenseUtility.getContextVersion(contextNode);
    if (version < DigitalTwinConstants.DTDL_MIN_VERSION || version > DigitalTwinConstants.DTDL_CURRENT_VERSION) {
      return undefined;
    }
    return { jsonNode, version };
  }

  /**
   * get verson of DigitalTwin context,
   * return 0 if it has no DigitalTwin context
   * @param node json node
   */
  public static getContextVersion(node: parser.Node): number {
    // @context can be array or string
    if (node.type === JsonNodeType.String) {
      return IntelliSenseUtility.resolveVersion(node.value);
    } else if (node.type === JsonNodeType.Array && node.children) {
      for (const child of node.children) {
        if (child.type !== JsonNodeType.String) {
          return 0;
        }
        const version: number = IntelliSenseUtility.resolveVersion(child.value);
        if (version) {
          return version;
        }
      }
    }
    return 0;
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
   * get property value of object by key name
   * @param key key name
   * @param node json node
   */
  public static getPropertyValueOfObjectByKey(key: string, node: parser.Node): parser.Node | undefined {
    if (node.type !== JsonNodeType.Object || !node.children) {
      return undefined;
    }
    let propertyPair: PropertyPair | undefined;
    for (const child of node.children) {
      propertyPair = IntelliSenseUtility.parseProperty(child);
      if (!propertyPair) {
        continue;
      }
      if (propertyPair.name.value === key) {
        return propertyPair.value;
      }
    }
    return undefined;
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
   * get outer property pair from current node
   * @param node json node
   */
  public static getOuterPropertyName(node: parser.Node): string {
    if (node.type !== JsonNodeType.Object) {
      return Constants.EMPTY_STRING;
    }
    const outerProperty: parser.Node | undefined = IntelliSenseUtility.getParentJsonNodeByType(
      node,
      JsonNodeType.Property,
    );
    if (!outerProperty) {
      return Constants.EMPTY_STRING;
    }

    const outerPropertyPair: PropertyPair | undefined = IntelliSenseUtility.parseProperty(outerProperty);
    return outerPropertyPair?.name.value || Constants.EMPTY_STRING;
  }

  /**
   * get parent json node by type
   * @param node json node
   * @param type json node type
   */
  public static getParentJsonNodeByType(node: parser.Node | undefined, type: JsonNodeType): parser.Node | undefined {
    if (!node) {
      return undefined;
    }
    let parentNode: parser.Node | undefined = node.parent;
    while (parentNode) {
      if (parentNode.type === type) {
        return parentNode;
      }
      parentNode = parentNode.parent;
    }
    return undefined;
  }

  /**
   * check if json node is a container node
   * @param node json node
   */
  public static isContainerNode(node: parser.Node): boolean {
    return node.type === JsonNodeType.Array || node.type === JsonNodeType.Object;
  }

  /**
   * get type of enum value
   * @param name name
   */
  public static getTypeOfEnumValue(name: string): string {
    switch (name) {
      case DigitalTwinConstants.VALUE_SCHEMA_INTEGER:
        return Literal.Integer;
      case DigitalTwinConstants.VALUE_SCHEMA_STRING:
        return Literal.String;
      default:
        return Constants.EMPTY_STRING;
    }
  }

  private static graph: DigitalTwinGraph;

  /**
   * resolve version from context
   * @param context context value
   */
  private static resolveVersion(context: string): number {
    const groups: RegExpMatchArray | null = context.match(DigitalTwinConstants.CONTEXT_REGEX);
    if (groups && groups.length === 2) {
      return parseInt(groups[1], Constants.DEFAULT_RADIX);
    }
    return 0;
  }

  private constructor() {}
}
