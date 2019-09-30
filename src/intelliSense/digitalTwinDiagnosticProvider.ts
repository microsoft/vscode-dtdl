// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as parser from "jsonc-parser";
import * as vscode from "vscode";
import { DigitalTwinGraph } from "./digitalTwinGraph";

export class DigitalTwinDiagnosticProvider {
  private static getNodeRange(document: vscode.TextDocument, node: parser.Node): vscode.Range {
    return new vscode.Range(document.positionAt(node.offset), document.positionAt(node.offset + node.length));
  }

  constructor(private readonly context: vscode.ExtensionContext) {}

  public updateDiagnostics(document: vscode.TextDocument, collection: vscode.DiagnosticCollection): void {
    if (!document) {
      return;
    }

    const graph: DigitalTwinGraph = DigitalTwinGraph.getInstance(this.context);

    collection.delete(document.uri);
    const diagnostics: vscode.Diagnostic[] = [];
    // generate diagnostics

    collection.set(document.uri, diagnostics);
  }
}
