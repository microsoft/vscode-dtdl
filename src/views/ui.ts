// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from "path";
import * as vscode from "vscode";
import { UserCancelledError } from "../common/userCancelledError";
import { Utility } from "../common/utility";
import { ModelType } from "../deviceModel/deviceModelManager";
import { UIConstants } from "./uiConstants";

export enum MessageType {
  Info,
  Warn,
  Error,
}

export class UI {
  public static async openAndShowTextDocument(filePath: string): Promise<void> {
    const folder: string = path.dirname(filePath);
    await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(folder), false);
    await vscode.window.showTextDocument(vscode.Uri.file(filePath));
  }

  public static showNotification(type: MessageType, message: string): void {
    switch (type) {
      case MessageType.Info:
        vscode.window.showInformationMessage(message);
        break;
      case MessageType.Warn:
        vscode.window.showWarningMessage(message);
        break;
      case MessageType.Error:
        vscode.window.showErrorMessage(message);
        break;
      default:
    }
  }

  public static async selectRootFolder(label: string): Promise<string> {
    const worksapceFolders: vscode.WorkspaceFolder[] | undefined = vscode.workspace.workspaceFolders;
    // use the only workspace as default
    if (worksapceFolders && worksapceFolders.length === 1) {
      return worksapceFolders[0].uri.fsPath;
    }

    // select workspace or open specified folder
    let items: vscode.QuickPickItem[] = [];
    if (worksapceFolders) {
      items = worksapceFolders.map((f: vscode.WorkspaceFolder) => {
        const fsPath: string = f.uri.fsPath;
        return {
          label: path.basename(fsPath),
          description: fsPath,
        };
      });
    }
    items.push({ label: UIConstants.BROWSE_LABEL, description: "" });
    const selected: vscode.QuickPickItem = await UI.showQuickPick(label, items);

    // browse to open folder
    return selected.description ? selected.description : await UI.showOpenDialog(label);
  }

  public static async showQuickPick(label: string, items: vscode.QuickPickItem[]): Promise<vscode.QuickPickItem> {
    const options: vscode.QuickPickOptions = {
      placeHolder: label,
      ignoreFocusOut: true,
    };

    const result: vscode.QuickPickItem | undefined = await vscode.window.showQuickPick(items, options);
    if (!result) {
      throw new UserCancelledError(label);
    }
    return result;
  }

  public static async showOpenDialog(label: string, defaultUri?: vscode.Uri): Promise<string> {
    const options: vscode.OpenDialogOptions = {
      openLabel: label,
      defaultUri,
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
    };

    const results: vscode.Uri[] | undefined = await vscode.window.showOpenDialog(options);
    if (!results || results.length === 0) {
      throw new UserCancelledError(label);
    }
    return results[0].fsPath;
  }

  public static async inputModelName(label: string, type: ModelType, folder: string): Promise<string> {
    const placeHolder = `${type} name`;
    const validateInput = async (name: string): Promise<string | undefined> => {
      return await Utility.validateModelName(name, type, folder);
    };
    return await UI.showInputBox(label, placeHolder, validateInput);
  }

  public static async showInputBox(
    label: string,
    placeHolder: string,
    validateInput?: (s: string) => Promise<string | undefined>,
    value?: string,
    ignoreFocusOut: boolean = true,
  ): Promise<string> {
    const options: vscode.InputBoxOptions = {
      prompt: label,
      placeHolder,
      validateInput,
      value,
      ignoreFocusOut,
    };

    const result: string | undefined = await vscode.window.showInputBox(options);
    if (!result) {
      throw new UserCancelledError(label);
    }
    return result;
  }

  public static async inputConnectionString(label: string): Promise<string> {
    const validateInput = async (name: string): Promise<string | undefined> => {
      return await Utility.validateConnctionString(name);
    };
    return await UI.showInputBox(label, UIConstants.REPOSITORY_CONNECTION_STRING_TEMPLATE, validateInput);
  }

  private constructor() {}
}
