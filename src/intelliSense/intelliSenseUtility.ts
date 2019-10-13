// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as parser from "jsonc-parser";
import * as vscode from "vscode";
import { DigitalTwinConstants } from "./digitalTwinConstants";
import { JsonNodeType } from "./digitalTwinDiagnosticProvider";
import { DigitalTwinGraph, PropertyNode } from "./digitalTwinGraph";

export class IntelliSenseUtility {
  public static initGraph(context: vscode.ExtensionContext): boolean {
    IntelliSenseUtility.graph = DigitalTwinGraph.getInstance(context);
    return IntelliSenseUtility.graph.initialized();
  }

  public static parseDigitalTwinModel(document: vscode.TextDocument): parser.Node | undefined {
    const errors: parser.ParseError[] = [];
    const jsonNode: parser.Node = parser.parseTree(document.getText(), errors);
    if (errors.length > 0) {
      return undefined;
    }

    const contextPath: string[] = [DigitalTwinConstants.CONTEXT];
    const contextNode: parser.Node | undefined = parser.findNodeAtLocation(jsonNode, contextPath);
    if (contextNode && IntelliSenseUtility.isDigitalTwinContext(contextNode)) {
      return jsonNode;
    }
    return undefined;
  }

  public static isDigitalTwinContext(contextNode: parser.Node): boolean {
    // Assume @context is string node
    if (contextNode.type === JsonNodeType.String) {
      return DigitalTwinConstants.CONTEXT_REGEX.test(contextNode.value as string);
    }
    return false;
  }

  public static getEntryNode(): PropertyNode | undefined {
    return IntelliSenseUtility.getPropertyNode(DigitalTwinConstants.ENTRY_NODE);
  }

  public static getPropertyNode(propertyName: string): PropertyNode | undefined {
    return IntelliSenseUtility.graph.getPropertyNode(propertyName);
  }

  private static graph: DigitalTwinGraph;
  private constructor() {}
}
