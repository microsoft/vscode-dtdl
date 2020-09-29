// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from "path";
import * as vscode from "vscode";
import { Constants } from "../common/constants";
import { UserCancelledError } from "../common/userCancelledError";
import { Utility } from "../common/utility";
import { ModelType } from "../deviceModel/deviceModelManager";
import { UIConstants } from "./uiConstants";

/**
 * Message type
 */
export enum MessageType {
  Info,
  Warn,
  Error
}

/**
 * Utility for UI
 */
export class UI {
  /**
   * open and show text document
   * @param filePath file path
   */
  public static async openAndShowTextDocument(filePath: string): Promise<void> {
    const folder: string = path.dirname(filePath);
    await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(folder), false);
    await vscode.window.showTextDocument(vscode.Uri.file(filePath));
  }

  /**
   * show notification in non-blocking way
   * @param type message type
   * @param message message
   */
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

  /**
   * select root folder
   * @param label label
   */
  public static async selectRootFolder(label: string): Promise<string> {
    const workspaceFolders: ReadonlyArray<vscode.WorkspaceFolder> | undefined = vscode.workspace.workspaceFolders;
    // use the only folder as default
    if (workspaceFolders && workspaceFolders.length === 1) {
      return workspaceFolders[0].uri.fsPath;
    }
    // select folder or browse
    let items: vscode.QuickPickItem[] = [];
    if (workspaceFolders) {
      items = workspaceFolders.map(folder => {
        const fsPath: string = folder.uri.fsPath;
        return {
          label: path.basename(fsPath),
          description: fsPath
        };
      });
    }
    items.push({ label: UIConstants.BROWSE_LABEL, description: Constants.EMPTY_STRING });
    const selected: vscode.QuickPickItem = await UI.showQuickPick(label, items);
    return selected.description || (await UI.showOpenDialog(label));
  }

  /**
   * select template file
   * @param label label
   * @param folder template folder
   */
  public static async selectTemplateFile(label: string, folder: string): Promise<string> {
    const files: string[] = Utility.listFile(folder, Constants.TEMPLATE_FILE_GLOB);
    if (!files.length) {
      const message = `${UIConstants.TEMPLATES_NOT_FOUND_MSG} ${folder}`;
      throw new Error(message);
    }
    if (files.length === 1) {
      return files[0];
    }
    const items: vscode.QuickPickItem[] = files.map(file => {
      return {
        label: file
      };
    });
    const selected: vscode.QuickPickItem = await UI.showQuickPick(label, items);
    return selected.label;
  }

  /**
   * input model name and validate
   * @param label label
   * @param type model type
   * @param folder target folder
   */
  public static async inputModelName(label: string, type: ModelType, folder: string): Promise<string> {
    const placeHolder = `${type} name`;
    const validateInput = async (name: string): Promise<string | undefined> => {
      return await Utility.validateModelName(name, type, folder);
    };
    return await UI.showInputBox(label, placeHolder, validateInput);
  }

  /**
   * show quick pick items
   * @param label label
   * @param items quick pick item list
   */
  public static async showQuickPick(label: string, items: vscode.QuickPickItem[]): Promise<vscode.QuickPickItem> {
    const options: vscode.QuickPickOptions = {
      placeHolder: label,
      ignoreFocusOut: true
    };
    const selected: vscode.QuickPickItem | undefined = await vscode.window.showQuickPick(items, options);
    if (!selected) {
      throw new UserCancelledError(label);
    }
    return selected;
  }

  /**
   * show open dialog
   * @param label label
   * @param defaultUri default uri
   */
  public static async showOpenDialog(label: string, defaultUri?: vscode.Uri): Promise<string> {
    const options: vscode.OpenDialogOptions = {
      openLabel: label,
      defaultUri,
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false
    };
    const selected: vscode.Uri[] | undefined = await vscode.window.showOpenDialog(options);
    if (!selected || !selected.length) {
      throw new UserCancelledError(label);
    }
    return selected[0].fsPath;
  }

  /**
   * show input box
   * @param label label
   * @param placeHolder placeHolder
   * @param validateInput validate input function
   * @param value value
   * @param ignoreFocusOut identify if ignore focus out
   */
  public static async showInputBox(
    label: string,
    placeHolder: string,
    validateInput?: (s: string) => string | undefined | Promise<string | undefined>,
    value?: string,
    ignoreFocusOut = true
  ): Promise<string> {
    const options: vscode.InputBoxOptions = {
      prompt: label,
      placeHolder,
      validateInput,
      value,
      ignoreFocusOut
    };
    const input: string | undefined = await vscode.window.showInputBox(options);
    if (!input) {
      throw new UserCancelledError(label);
    }
    return input;
  }

  private constructor() {}
}
