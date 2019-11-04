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
  label?: string;
  isAbstract?: boolean;
  children?: ClassNode[];
  properties?: PropertyNode[];
  enums?: string[];
  constraint?: ConstraintNode;
}

/**
 * Property node of DigitalTwin graph
 */
export interface PropertyNode {
  id: string;
  label?: string;
  isArray?: boolean;
  comment?: string;
  range?: ClassNode[];
  constraint?: ConstraintNode;
}

/**
 * Constraint node of DigitalTwin graph
 */
export interface ConstraintNode {
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  required?: string[];
}

/**
 * Context node of DigitalTwin graph
 */
interface ContextNode {
  name: string;
  isArray?: boolean;
}

/**
 * Value schema definition for DigitalTwin graph
 */
export enum ValueSchema {
  String = "http://www.w3.org/2001/XMLSchema#string",
  Int = "http://www.w3.org/2001/XMLSchema#int",
  Boolean = "http://www.w3.org/2001/XMLSchema#boolean",
}

/**
 * Node type definition for DigitalTwin graph
 */
enum NodeType {
  Class = "http://www.w3.org/2000/01/rdf-schema#Class",
  Property = "http://www.w3.org/1999/02/22-rdf-syntax-ns#Property",
}

/**
 * Edge type definition for DigitalTwin graph
 */
enum EdgeType {
  Type = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
  Range = "http://www.w3.org/2000/01/rdf-schema#range",
  Label = "http://www.w3.org/2000/01/rdf-schema#label",
  Domain = "http://www.w3.org/2000/01/rdf-schema#domain",
  SubClassOf = "http://www.w3.org/2000/01/rdf-schema#subClassOf",
  Comment = "http://www.w3.org/2000/01/rdf-schema#comment",
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

  /**
   * get class type of class node
   * @param classNode class node
   */
  public static getClassType(classNode: ClassNode): string {
    return classNode.label || classNode.id;
  }

  /**
   * get valid types from property node range
   * @param propertyNode property node
   */
  public static getValidTypes(propertyNode: PropertyNode): string[] {
    if (!propertyNode.range) {
      return [];
    }
    return propertyNode.range.map((c) => {
      if (c.label) {
        return c.label;
      } else {
        // get the name of XMLSchema
        const index: number = c.id.lastIndexOf(DigitalTwinConstants.SCHEMA_SEPARATOR);
        return index === -1 ? c.id : c.id.slice(index + 1);
      }
    });
  }

  /**
   * check if class node is a object class, not one of the following
   * 1. abstract class
   * 2. enum
   * 3. value schema
   * @param classNode class node
   */
  public static isObjectClass(classNode: ClassNode): boolean {
    if (classNode.isAbstract || classNode.enums || !classNode.label) {
      return false;
    }
    return true;
  }

  private static instance: DigitalTwinGraph;

  /**
   * check if json object is a valid constraint node
   * @param object object data
   */
  private static isConstraintNode(object: any): object is ConstraintNode {
    return (
      object.minItems || object.maxItems || object.minLength || object.maxLength || object.pattern || object.required
    );
  }

  /**
   * validate edge
   * @param edge edge data
   */
  private static validateEdge(edge: any): boolean {
    return edge.SourceNode && edge.TargetNode && edge.Label;
  }

  /**
   * check if object is an array
   * @param object object data
   */
  private static isArrayType(object: any): boolean {
    const container = object[DigitalTwinConstants.CONTAINER];
    if (container && typeof container === "string") {
      return container === DigitalTwinConstants.LIST || container === DigitalTwinConstants.SET;
    }
    return false;
  }

  /**
   * check if the name is a reserved name
   * @param name name
   */
  private static isReservedName(name: string): boolean {
    return name.startsWith(DigitalTwinConstants.RESERVED);
  }

  /**
   * resolve definition
   * @param context extension context
   * @param fileName file name
   */
  private static async resolveDefinition(context: vscode.ExtensionContext, fileName: string): Promise<any> {
    const filePath: string = context.asAbsolutePath(
      path.join(Constants.RESOURCE_FOLDER, Constants.DEFINITION_FOLDER, fileName),
    );
    return await Utility.getJsonContent(filePath);
  }

  private classNodes: Map<string, ClassNode>;
  private propertyNodes: Map<string, PropertyNode>;
  private contextNodes: Map<string, ContextNode>;
  private constraintNodes: Map<string, ConstraintNode>;
  private reversedIndex: Map<string, string>;
  private vocabulary: string;
  private constructor() {
    this.classNodes = new Map<string, ClassNode>();
    this.propertyNodes = new Map<string, PropertyNode>();
    this.contextNodes = new Map<string, ContextNode>();
    this.constraintNodes = new Map<string, ConstraintNode>();
    this.reversedIndex = new Map<string, string>();
    this.vocabulary = Constants.EMPTY_STRING;
  }

  /**
   * check if DigitalTwin graph is initialized
   */
  public initialized(): boolean {
    return this.vocabulary !== Constants.EMPTY_STRING;
  }

  /**
   * get property node by name
   * @param name name
   */
  public getPropertyNode(name: string): PropertyNode | undefined {
    const id: string = this.reversedIndex.get(name) || name;
    return this.propertyNodes.get(id);
  }

  /**
   * get class node by name
   * @param name name
   */
  public getClassNode(name: string): ClassNode | undefined {
    const id: string = this.reversedIndex.get(name) || this.getId(name);
    return this.classNodes.get(id);
  }

  /**
   * inititalize DigitalTwin graph
   * @param context extension context
   */
  private async init(context: vscode.ExtensionContext): Promise<void> {
    let contextJson;
    let constraintJson;
    let graphJson;
    // load definition file
    try {
      contextJson = await DigitalTwinGraph.resolveDefinition(context, Constants.CONTEXT_FILE_NAME);
      constraintJson = await DigitalTwinGraph.resolveDefinition(context, Constants.CONSTRAINT_FILE_NAME);
      graphJson = await DigitalTwinGraph.resolveDefinition(context, Constants.GRAPH_FILE_NAME);
    } catch (error) {
      return;
    }
    // build graph by definitions
    this.buildContext(contextJson);
    this.buildConstraint(constraintJson);
    this.buildGraph(graphJson);
  }

  /**
   * get node id of DigitalTwin graph
   * @param name name
   */
  private getId(name: string): string {
    return this.vocabulary + name;
  }

  /**
   * build context nodes by id and reversed index
   * @param contextJson json object of context definition
   */
  private buildContext(contextJson: any): void {
    let id: string;
    const context = contextJson[DigitalTwinConstants.CONTEXT];
    this.vocabulary = context[DigitalTwinConstants.VOCABULARY] as string;
    for (const key in context) {
      if (DigitalTwinGraph.isReservedName(key)) {
        continue;
      }
      const value = context[key];
      if (typeof value === "string") {
        id = this.getId(value);
        this.contextNodes.set(id, { name: key, isArray: false });
      } else {
        const isArray: boolean = DigitalTwinGraph.isArrayType(value);
        id = this.getId(value[DigitalTwinConstants.ID] as string);
        this.contextNodes.set(id, { name: key, isArray });
      }
      this.reversedIndex.set(key, id);
    }
  }

  /**
   * build constraint nodes by name
   * @param constraintJson json object of constraint definition
   */
  private buildConstraint(constraintJson: any): void {
    for (const key in constraintJson) {
      if (DigitalTwinGraph.isConstraintNode(constraintJson[key])) {
        this.constraintNodes.set(key, constraintJson[key]);
      }
    }
  }

  /**
   * build DigitalTwin graph on definitions of context, constraint and graph
   * @param graphJson json object of graph definition
   */
  private buildGraph(graphJson: any): void {
    for (const edge of graphJson.Edges) {
      if (DigitalTwinGraph.validateEdge(edge)) {
        this.handleEdge(edge);
      }
    }
    this.adjustNode();
    this.expandProperties();
    this.buildEntryNode();
  }

  /**
   * handle data of edge
   * @param edge edge data
   */
  private handleEdge(edge: any): void {
    switch (edge.Label) {
      case EdgeType.Type:
        this.handleEdgeOfType(edge);
        break;
      case EdgeType.Label:
        this.handleEdgeOfLabel(edge);
        break;
      case EdgeType.Domain:
        this.handleEdgeOfDomain(edge);
        break;
      case EdgeType.Range:
        this.handleEdgeOfRange(edge);
        break;
      case EdgeType.SubClassOf:
        this.handleEdgeOfSubClassOf(edge);
        break;
      case EdgeType.Comment:
        this.handleEdgeOfComment(edge);
        break;
      default:
    }
  }

  /**
   * handle data of Type edge
   * 1. create class/property node, set label and constraint
   * 2. add enum value to enum node
   * @param edge edge data
   */
  private handleEdgeOfType(edge: any): void {
    const id: string = edge.SourceNode.Id as string;
    const type: string = edge.TargetNode.Id as string;
    switch (type) {
      case NodeType.Class:
        this.ensureClassNode(id);
        break;
      case NodeType.Property:
        this.ensurePropertyNode(id);
        break;
      default:
        // mark target class as enum node
        const contextNode: ContextNode | undefined = this.contextNodes.get(id);
        const enumValue: string = contextNode ? contextNode.name : id;
        const enumNode: ClassNode = this.ensureClassNode(type);
        if (!enumNode.enums) {
          enumNode.enums = [];
        }
        enumNode.enums.push(enumValue);
    }
  }

  /**
   * handle date of Label edge
   * 1. assume Type edge is handled before Label edge
   * 2. set label and constraint if not defined
   * @param edge edge data
   */
  private handleEdgeOfLabel(edge: any): void {
    const id: string = edge.SourceNode.Id as string;
    const label: string = edge.TargetNode.Value as string;
    const propertyNode: PropertyNode | undefined = this.propertyNodes.get(id);
    // skip property node since the value has been set in Type edge
    if (propertyNode) {
      return;
    }
    const classNode: ClassNode = this.ensureClassNode(id);
    if (!classNode.label) {
      classNode.label = label;
      const constraintNode: ConstraintNode | undefined = this.constraintNodes.get(label);
      if (constraintNode) {
        classNode.constraint = constraintNode;
      }
    }
  }

  /**
   * handle data of Domain edge
   * 1. add property to class node
   * @param edge edge data
   */
  private handleEdgeOfDomain(edge: any): void {
    const id: string = edge.SourceNode.Id as string;
    const classId: string = edge.TargetNode.Id as string;
    const propertyNode: PropertyNode = this.ensurePropertyNode(id);
    const classNode: ClassNode = this.ensureClassNode(classId);
    if (!classNode.properties) {
      classNode.properties = [];
    }
    classNode.properties.push(propertyNode);
  }

  /**
   * handle data of Range edge
   * 1. add range to property node
   * @param edge edge data
   */
  private handleEdgeOfRange(edge: any): void {
    const id: string = edge.SourceNode.Id as string;
    const classId: string = edge.TargetNode.Id as string;
    const propertyNode: PropertyNode = this.ensurePropertyNode(id);
    const classNode: ClassNode = this.ensureClassNode(classId);
    if (!propertyNode.range) {
      propertyNode.range = [];
    }
    propertyNode.range.push(classNode);
  }

  /**
   * handle data of SubClassOf edge
   * 1. add children to base class node
   * @param edge edge data
   */
  private handleEdgeOfSubClassOf(edge: any): void {
    const id: string = edge.SourceNode.Id as string;
    const baseId: string = edge.TargetNode.Id as string;
    const classNode: ClassNode = this.ensureClassNode(id);
    const baseClassNode: ClassNode = this.ensureClassNode(baseId);
    if (!baseClassNode.children) {
      baseClassNode.children = [];
    }
    baseClassNode.children.push(classNode);
  }

  /**
   * handle data of Comment edge
   * 1. set comment of property node
   * @param edge edge data
   */
  private handleEdgeOfComment(edge: any): void {
    const id: string = edge.SourceNode.Id as string;
    const comment: string = edge.TargetNode.Value as string;
    // TODO:(erichen): need to check if comment only exists in property
    const propertyNode: PropertyNode | undefined = this.propertyNodes.get(id);
    if (propertyNode) {
      propertyNode.comment = comment;
    }
  }

  /**
   * ensure class node exist, create if not exist
   * @param id node id
   */
  private ensureClassNode(id: string): ClassNode {
    let classNode: ClassNode | undefined = this.classNodes.get(id);
    if (!classNode) {
      classNode = { id };
      const contextNode: ContextNode | undefined = this.contextNodes.get(id);
      if (contextNode) {
        classNode.label = contextNode.name;
        const constraintNode: ConstraintNode | undefined = this.constraintNodes.get(contextNode.name);
        if (constraintNode) {
          classNode.constraint = constraintNode;
        }
      }
      this.classNodes.set(id, classNode);
    }
    return classNode;
  }

  /**
   * ensure property node exist, create if not exist
   * @param id node id
   */
  private ensurePropertyNode(id: string): PropertyNode {
    let propertyNode: PropertyNode | undefined = this.propertyNodes.get(id);
    if (!propertyNode) {
      propertyNode = { id };
      const contextNode: ContextNode | undefined = this.contextNodes.get(id);
      if (contextNode) {
        propertyNode.label = contextNode.name;
        propertyNode.isArray = contextNode.isArray;
        const constraintNode: ConstraintNode | undefined = this.constraintNodes.get(contextNode.name);
        if (constraintNode) {
          propertyNode.constraint = constraintNode;
        }
      }
      this.propertyNodes.set(id, propertyNode);
    }
    return propertyNode;
  }

  /**
   * adjust node to meet DigitalTwin special definition
   */
  private adjustNode(): void {
    // build reserved property
    const stringNode: ClassNode = this.ensureClassNode(ValueSchema.String);
    this.buildReservedProperty(DigitalTwinConstants.ID, stringNode);

    // mark abstract class
    this.markAbstractClass(DigitalTwinConstants.SCHEMA_NODE);
    this.markAbstractClass(DigitalTwinConstants.UNIT_NODE);

    // update label and range of interfaceSchema property
    const propertyNode: PropertyNode | undefined = this.propertyNodes.get(
      this.getId(DigitalTwinConstants.INTERFACE_SCHEMA_NODE),
    );
    if (propertyNode) {
      propertyNode.label = DigitalTwinConstants.SCHEMA;
      if (propertyNode.range) {
        propertyNode.range.push(stringNode);
        propertyNode.constraint = this.constraintNodes.get(DigitalTwinConstants.ID);
      }
    }
  }

  /**
   * build reserved property
   * @param id node id
   * @param classNode class node of reserved property range
   */
  private buildReservedProperty(id: string, classNode: ClassNode): void {
    const propertyNode: PropertyNode = { id, range: [classNode] };
    const constraintNode: ConstraintNode | undefined = this.constraintNodes.get(id);
    if (constraintNode) {
      propertyNode.constraint = constraintNode;
    }
    this.propertyNodes.set(id, propertyNode);
  }

  /**
   * mark class node as abstract class
   * @param name class node name
   */
  private markAbstractClass(name: string): void {
    const classNode: ClassNode | undefined = this.classNodes.get(this.getId(name));
    if (classNode) {
      classNode.isAbstract = true;
    }
  }

  /**
   * expand properties from base class node
   */
  private expandProperties(): void {
    let classNode: ClassNode | undefined = this.classNodes.get(this.getId(DigitalTwinConstants.BASE_CLASS));
    if (!classNode) {
      return;
    }
    const queue: ClassNode[] = [];
    while (classNode) {
      if (classNode.children) {
        for (const child of classNode.children) {
          // skip enum node
          if (child.enums) {
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
      }
      classNode = queue.shift();
    }
  }

  /**
   * build entry node of DigitalTwin graph
   */
  private buildEntryNode(): void {
    const interfaceNode: ClassNode | undefined = this.classNodes.get(this.getId(DigitalTwinConstants.INTERFACE_NODE));
    const capabilityModelNode: ClassNode | undefined = this.classNodes.get(
      this.getId(DigitalTwinConstants.CAPABILITY_MODEL_NODE),
    );
    if (interfaceNode && capabilityModelNode) {
      const entryNode: PropertyNode = {
        id: DigitalTwinConstants.ENTRY_NODE,
        range: [interfaceNode, capabilityModelNode],
      };
      this.propertyNodes.set(entryNode.id, entryNode);
    }
  }
}
