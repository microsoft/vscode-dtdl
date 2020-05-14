// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from "path";
import * as vscode from "vscode";
import { Constants } from "../common/constants";
import { Utility } from "../common/utility";
import { DigitalTwinConstants } from "./digitalTwinConstants";

/**
 * Class node of DigitalTwin graph
 */
export interface ClassNode {
  id: string;
  name: string;
  isAbstract?: boolean;
  isAugmentable?: boolean;
  children?: string[];
  properties?: string[];
  instances?: string[];
}

/**
 * Property node of DigitalTwin graph
 */
export interface PropertyNode {
  id: string;
  name: string;
  nodeKind: string;
  type?: string;
  isPlural?: boolean;
  isRequired?: boolean;
  isTypeInferable?: boolean;
  dictionaryKey?: string;
  constraint: ConstraintNode;
}

/**
 * Constraint node of DigitalTwin graph
 */
export interface ConstraintNode {
  minInclusive?: number;
  maxInclusive?: number;
  minCount?: number;
  maxCount?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  in?: string[];
  exclude?: string[];
}

/**
 * Literal kind of DigitalTWin graph
 */
export enum Literal {
  LangString = "http://www.w3.org/1999/02/22-rdf-syntax-ns#langString",
  String = "http://www.w3.org/2001/XMLSchema#string",
  Integer = "http://www.w3.org/2001/XMLSchema#integer",
  Boolean = "http://www.w3.org/2001/XMLSchema#boolean",
}

export enum NodeKind {
  Literal = "Literal",
  IRI = "IRI",
}

/**
 * Element kind of graph json
 */
enum GraphElement {
  BaseClass = "baseClass",
  PartitionClass = "partitionClass",
  Class = "class",
  Property = "property",
}

/**
 * DigitalTwin graph
 */
export class DigitalTwinGraph {
  /**
   * get singleton instance of DigitalTwin graph
   * @param context extension context
   */
  public static async getInstance(context: vscode.ExtensionContext): Promise<DigitalTwinGraph> {
    if (!DigitalTwinGraph.instance) {
      DigitalTwinGraph.instance = new DigitalTwinGraph();
      await DigitalTwinGraph.instance.init(context);
    }
    return DigitalTwinGraph.instance;
  }

  private static instance: DigitalTwinGraph;

  /**
   * resolve definition from file
   * @param context extension context
   * @param fileName file name
   */
  private static async resolveDefinition(context: vscode.ExtensionContext, fileName: string): Promise<any> {
    const filePath: string = context.asAbsolutePath(
      path.join(Constants.RESOURCE_FOLDER, Constants.DEFINITION_FOLDER, fileName),
    );
    return await Utility.getJsonContent(filePath);
  }

  /**
   * check if it is a valid node
   * @param node node
   */
  private static isValidNode(node: any): boolean {
    return node.id && node.name;
  }

  private classNodes: Map<string, ClassNode>;
  private propertyNodes: Map<string, PropertyNode>;
  private dtdlContext: Map<string, string>;
  private baseClass: string;
  private partitionClass: string[];
  private constructor() {
    this.classNodes = new Map<string, ClassNode>();
    this.propertyNodes = new Map<string, PropertyNode>();
    this.dtdlContext = new Map<string, string>();
    this.baseClass = Constants.EMPTY_STRING;
    this.partitionClass = [];
  }

  /**
   * check if DigitalTwin graph is initialized
   */
  public initialized(): boolean {
    return this.baseClass !== Constants.EMPTY_STRING;
  }

  /**
   * check if class is partition
   * @param name class name
   */
  public isPartitionClass(name: string): boolean {
    return this.partitionClass.includes(this.getNodeId(name));
  }

  /**
   * get property node by name or id
   * @param nameOrId property name or id
   */
  public getPropertyNode(nameOrId: string): PropertyNode | undefined {
    return this.propertyNodes.get(this.getNodeId(nameOrId));
  }

  /**
   * get class node by name
   * @param name name
   */
  public getClassNode(name: string): ClassNode | undefined {
    return this.classNodes.get(this.getNodeId(name));
  }

  /**
   * get properties of class node
   * @param classNode class node
   */
  public getPropertiesOfClassNode(classNode: ClassNode): PropertyNode[] {
    let propertyNode: PropertyNode | undefined;
    const properties: PropertyNode[] = [];
    if (classNode.properties) {
      for (const property of classNode.properties) {
        propertyNode = this.propertyNodes.get(property);
        if (propertyNode) {
          properties.push(propertyNode);
        }
      }
    }
    return properties;
  }

  /**
   * get children of class node
   * @param classNode class node
   */
  public getChildrenOfClassNode(classNode: ClassNode): ClassNode[] {
    let childNode: ClassNode | undefined;
    const children: ClassNode[] = [];
    if (classNode.children) {
      for (const child of classNode.children) {
        childNode = this.classNodes.get(child);
        if (childNode) {
          children.push(childNode);
        }
      }
    }
    return children;
  }

  /**
   * get obverse children of abstract class
   * @param abstractClass abstract class node
   */
  public getObverseChildrenOfAbstractClass(abstractClass: ClassNode): ClassNode[] {
    const children: ClassNode[] = [];
    if (!abstractClass.isAbstract) {
      return children;
    }
    const queue: ClassNode[] = [];
    let classNode: ClassNode | undefined = abstractClass;
    while (classNode) {
      for (const child of this.getChildrenOfClassNode(classNode)) {
        if (child.isAbstract) {
          queue.push(child);
        } else if (!child.instances) {
          children.push(child);
        }
      }
      classNode = queue.shift();
    }
    return children;
  }

  /**
   * get all instances of abstract class
   * @param abstractClass abstract class node
   */
  public getInstancesOfAbstractClass(abstractClass: ClassNode): string[] {
    const instances: string[] = [];
    if (!abstractClass.isAbstract) {
      return instances;
    }
    const queue: ClassNode[] = [];
    let classNode: ClassNode | undefined = abstractClass;
    while (classNode) {
      for (const child of this.getChildrenOfClassNode(classNode)) {
        if (child.isAbstract) {
          queue.push(child);
        } else if (child.instances) {
          instances.push(...child.instances);
        }
      }
      classNode = queue.shift();
    }
    return instances;
  }

  /**
   * init DigitalTwin graph
   * @param context extension context
   */
  private async init(context: vscode.ExtensionContext): Promise<void> {
    let graphJson;
    try {
      graphJson = await DigitalTwinGraph.resolveDefinition(context, Constants.GRAPH_FILE_NAME);
    } catch (error) {
      return;
    }
    this.buildGraph(graphJson);
  }

  /**
   * build DigitalTwin graph
   * @param graphJson json object of graph definition
   */
  private buildGraph(graphJson: any): void {
    this.parse(graphJson);
    this.inheritProperties();
    this.addSentinelNodes();
  }

  /**
   * parse content of graph json
   * @param graphJson json object of graph definition
   */
  private parse(graphJson: any): void {
    for (const key in graphJson) {
      if (graphJson.hasOwnProperty(key)) {
        switch (key) {
          case GraphElement.BaseClass:
            this.baseClass = graphJson[key] as string;
            break;
          case GraphElement.PartitionClass:
            this.partitionClass = graphJson[key] as string[];
            break;
          case GraphElement.Class:
            for (const item of graphJson[key]) {
              if (DigitalTwinGraph.isValidNode(item)) {
                this.classNodes.set(item.id, item as ClassNode);
                this.addToContext(item.name, item.id);
              }
            }
            break;
          case GraphElement.Property:
            for (const item of graphJson[key]) {
              if (DigitalTwinGraph.isValidNode(item)) {
                this.propertyNodes.set(item.id, item as PropertyNode);
                this.addToContext(item.name, item.id);
              }
            }
            break;
          default:
        }
      }
    }
  }

  /**
   * add to DTDL context
   * @param name name
   * @param id id
   */
  private addToContext(name: string, id: string): void {
    // clear id value to identify the property name is shared by multiple class
    const value: string = this.dtdlContext.has(name) ? Constants.EMPTY_STRING : id;
    this.dtdlContext.set(name, value);
  }

  /**
   * inherit properties from base class
   */
  private inheritProperties(): void {
    let classNode: ClassNode | undefined = this.classNodes.get(this.baseClass);
    if (!classNode) {
      return;
    }
    const queue: ClassNode[] = [];
    while (classNode) {
      for (const child of this.getChildrenOfClassNode(classNode)) {
        // class which has instances doesn't need properties
        if (child.instances) {
          continue;
        }
        if (classNode.properties) {
          if (!child.properties) {
            child.properties = [];
          }
          child.properties.push(...classNode.properties);
        }
        queue.push(child);
      }
      classNode = queue.shift();
    }
  }

  /**
   * add sentinel nodes to DigitalTwin graph
   */
  private addSentinelNodes(): void {
    // entry node
    const entryNode: PropertyNode = {
      id: DigitalTwinConstants.ENTRY,
      name: Constants.EMPTY_STRING,
      nodeKind: Constants.EMPTY_STRING,
      constraint: {
        in: this.partitionClass,
      },
    };
    this.propertyNodes.set(entryNode.id, entryNode);
    // language node
    const languageNode: ClassNode = {
      id: Literal.LangString,
      name: DigitalTwinConstants.LANG_STRING,
    };
    this.classNodes.set(languageNode.id, languageNode);
  }

  /**
   * get node id by name or id
   * @param name name or id
   */
  private getNodeId(name: string): string {
    return this.dtdlContext.get(name) || name;
  }
}
