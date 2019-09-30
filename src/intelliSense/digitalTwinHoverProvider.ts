// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as vscode from "vscode";

export class DigitalTwinHoverProvider implements vscode.HoverProvider {
  constructor(private readonly context: vscode.ExtensionContext) {}

  public provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.Hover> {
    return null;
  }
}
