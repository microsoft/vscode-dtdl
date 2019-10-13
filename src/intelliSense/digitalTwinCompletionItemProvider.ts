// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as parser from "jsonc-parser";
import * as vscode from "vscode";
import { IntelliSenseUtility } from "./intelliSenseUtility";

export class DigitalTwinCompletionItemProvider implements vscode.CompletionItemProvider {
  public provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext,
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
    const jsonNode: parser.Node | undefined = IntelliSenseUtility.parseDigitalTwinModel(document);
    if (!jsonNode) {
      return undefined;
    }
  }
}
