// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from "path";
import * as vscode from "vscode";
import { Constants } from "../common/constants";
import { Utility } from "../common/utility";
import { DigitalTwinConstants } from "./digitalTwinConstants";

interface ClassNode {
  id: string;
  label?: string;
  children?: ClassNode[];
  properties?: PropertyNode[];
  enums?: string[];
  constraint?: ConstraintNode;
}

interface PropertyNode {
  id: string;
  label?: string;
  isArray?: boolean;
  range?: ClassNode[];
  constraint?: ConstraintNode;
}

interface ConstraintNode {
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: number;
  required?: string[];
}

interface ContextNode {
  name: string;
  isArray?: boolean;
}

enum NodeType {
  Class = "http://www.w3.org/2000/01/rdf-schema#Class",
  Property = "http://www.w3.org/1999/02/22-rdf-syntax-ns#Property",
}

enum EdgeType {
  Type = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
  Range = "http://www.w3.org/2000/01/rdf-schema#range",
  Label = "http://www.w3.org/2000/01/rdf-schema#label",
  Domain = "http://www.w3.org/2000/01/rdf-schema#domain",
  SubClassOf = "http://www.w3.org/2000/01/rdf-schema#subClassOf",
  Comment = "http://www.w3.org/2000/01/rdf-schema#comment", // Comment hasn't been used yet in DTDL
}

enum ValueSchema {
  String = "http://www.w3.org/2001/XMLSchema#string",
  Int = "http://www.w3.org/2001/XMLSchema#int",
  Boolean = "http://www.w3.org/2001/XMLSchema#boolean",
}

export class DigitalTwinGraph {
  public static getInstance(context: vscode.ExtensionContext): DigitalTwinGraph {
    if (!DigitalTwinGraph.instance) {
      DigitalTwinGraph.instance = new DigitalTwinGraph();
      DigitalTwinGraph.instance.init(context);
    }
    return DigitalTwinGraph.instance;
  }

  private static instance: DigitalTwinGraph;

  private static isConstraintNode(object: any): object is ConstraintNode {
    return (
      object.minItems || object.maxItems || object.minLength || object.maxLength || object.pattern || object.required
    );
  }

  private static validateEdge(edge: any): boolean {
    return edge.SourceNode && edge.TargetNode && edge.Label;
  }

  private static isArrayType(object: any): boolean {
    const container = object[DigitalTwinConstants.CONTAINER];
    if (container && typeof container === "string") {
      return container === DigitalTwinConstants.LIST || container === DigitalTwinConstants.SET;
    }
    return false;
  }

  private static readConfiguration(context: vscode.ExtensionContext, fileName: string): any {
    const filePath: string = context.asAbsolutePath(
      path.join(Constants.RESOURCE_FOLDER, Constants.DEFINITION_FOLDER, fileName),
    );
    return Utility.getJsonContentSync(filePath);
  }

  private classNodes: Map<string, ClassNode>;
  private propertyNodes: Map<string, PropertyNode>;
  private contextNodes: Map<string, ContextNode>;
  private constraintNodes: Map<string, ConstraintNode>;
  private vocabulary: string;
  private constructor() {
    this.classNodes = new Map<string, ClassNode>();
    this.propertyNodes = new Map<string, PropertyNode>();
    this.contextNodes = new Map<string, ContextNode>();
    this.constraintNodes = new Map<string, ConstraintNode>();
    this.vocabulary = "";
  }

  public initialized(): boolean {
    return this.vocabulary !== "";
  }

  private init(context: vscode.ExtensionContext): void {
    let contextJson;
    let constraintJson;
    let graphJson;

    try {
      contextJson = DigitalTwinGraph.readConfiguration(context, Constants.CONTEXT_FILE_NAME);
      constraintJson = DigitalTwinGraph.readConfiguration(context, Constants.CONSTRAINT_FILE_NAME);
      graphJson = DigitalTwinGraph.readConfiguration(context, Constants.GRAPH_FILE_NAME);
    } catch (error) {
      return;
    }

    this.buildContext(contextJson);
    this.buildConstraint(constraintJson);
    this.buildGraph(graphJson);
  }

  private buildContext(contextJson: any): void {
    const context = contextJson[DigitalTwinConstants.CONTEXT];
    this.vocabulary = context[DigitalTwinConstants.VOCABULARY] as string;

    for (const key in context) {
      if (key.startsWith(DigitalTwinConstants.RESERVED)) {
        continue;
      }
      const value = context[key];
      if (typeof value === "string") {
        this.contextNodes.set(this.vocabulary + value, { name: key, isArray: false });
      } else {
        const isArray: boolean = DigitalTwinGraph.isArrayType(value);
        this.contextNodes.set(this.vocabulary + (value[DigitalTwinConstants.ID] as string), { name: key, isArray });
      }
    }
  }

  private buildConstraint(constraintJson: any): void {
    for (const key in constraintJson) {
      if (DigitalTwinGraph.isConstraintNode(constraintJson[key])) {
        this.constraintNodes.set(key, constraintJson[key]);
      }
    }
  }

  private buildGraph(graphJson: any): void {
    for (const edge of graphJson.Edges) {
      if (DigitalTwinGraph.validateEdge(edge)) {
        this.handleEdge(edge);
      }
    }
    this.expandProperties();
  }

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
      default:
    }
  }

  /**
   * handle data of Type edge
   * 1. create class/property node, set label and constraint
   * 2. add enum value to enum node
   * @private
   * @param {*} edge
   * @memberof DigitalTwinGraph
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
        const contextNode: ContextNode | undefined = this.contextNodes.get(id);
        if (contextNode) {
          const enumNode: ClassNode = this.ensureClassNode(type);
          if (!enumNode.enums) {
            enumNode.enums = [];
          }
          enumNode.enums.push(contextNode.name);
        }
    }
  }

  /**
   * handle date of Label edge
   * 1. assume Type edge is handled before Label edge
   * 2. set label and constraint if not defined
   * @private
   * @param {*} edge
   * @memberof DigitalTwinGraph
   */
  private handleEdgeOfLabel(edge: any): void {
    const id: string = edge.SourceNode.Id as string;
    const label: string = edge.TargetNode.Value as string;

    const propertyNode: PropertyNode | undefined = this.propertyNodes.get(id);
    // skip property node
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
   * @private
   * @param {*} edge
   * @memberof DigitalTwinGraph
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
   * @private
   * @param {*} edge
   * @memberof DigitalTwinGraph
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
   * @private
   * @param {*} edge
   * @memberof DigitalTwinGraph
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

  private expandProperties(): void {
    const id: string = this.vocabulary + DigitalTwinConstants.ROOT_NODE;
    let classNode: ClassNode | undefined = this.classNodes.get(id);
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
}
