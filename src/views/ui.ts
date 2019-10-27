// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from "path";
import * as vscode from "vscode";
import { UserCancelledError } from "../common/userCancelledError";
import { Utility } from "../common/utility";
import { ModelType } from "../deviceModel/deviceModelManager";
import { ModelFileInfo } from "../modelRepository/modelRepositoryManager";
import { UIConstants } from "./uiConstants";

/**
 * Message type
 */
export enum MessageType {
  Info,
  Warn,
  Error,
}

/**
 * Choice type
 */
export enum ChoiceType {
  All = "All",
  Yes = "Yes",
  No = "No",
  Cancel = "Cancel",
}

/**
 * Quick pick item with custom data
 */
interface QuickPickItemWithData<T> extends vscode.QuickPickItem {
  data: T;
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
    const workspaceFolders: vscode.WorkspaceFolder[] | undefined = vscode.workspace.workspaceFolders;
    // use the only workspace as default
    if (workspaceFolders && workspaceFolders.length === 1) {
      return workspaceFolders[0].uri.fsPath;
    }
    // select workspace or open specified folder
    let items: vscode.QuickPickItem[] = [];
    if (workspaceFolders) {
      items = workspaceFolders.map((f: vscode.WorkspaceFolder) => {
        const fsPath: string = f.uri.fsPath;
        return {
          label: path.basename(fsPath),
          description: fsPath,
        };
      });
    }
    items.push({ label: UIConstants.BROWSE_LABEL, description: "" });
    const selected: vscode.QuickPickItem = await UI.showQuickPick(label, items);
    return selected.description || (await UI.showOpenDialog(label));
  }

  /**
   * show quick pick items
   * @param label label
   * @param items quick pick item list
   */
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
      canSelectMany: false,
    };
    const results: vscode.Uri[] | undefined = await vscode.window.showOpenDialog(options);
    if (!results || results.length === 0) {
      throw new UserCancelledError(label);
    }
    return results[0].fsPath;
  }

  /**
   * input model name and validate
   * @param label label
   * @param type model type
   * @param folder target folder
   */
  public static async inputModelName(label: string, type: ModelType, folder: string): Promise<string> {
    const placeHolder = `${type} name`;
    const validateInput = async (name: string) => {
      return await Utility.validateModelName(name, type, folder);
    };
    return await UI.showInputBox(label, placeHolder, validateInput);
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

  /**
   * input connection string
   * @param label label
   */
  public static async inputConnectionString(label: string): Promise<string> {
    const validateInput = (name: string) => {
      return Utility.validateNotEmpty(name, "Connection string");
    };
    return await UI.showInputBox(label, UIConstants.REPOSITORY_CONNECTION_STRING_TEMPLATE, validateInput);
  }

  /**
   * select model files
   * @param label label
   * @param type model type
   */
  public static async selectModelFiles(label: string, type?: ModelType): Promise<string[] | undefined> {
    const files: vscode.Uri[] = await vscode.workspace.findFiles(UIConstants.MODEL_FILE_GLOB);
    if (files.length === 0) {
      UI.showNotification(MessageType.Warn, UIConstants.MODELS_NOT_FOUND_MSG);
      return undefined;
    }
    // process in parallel
    const items: Array<QuickPickItemWithData<string>> = [];
    await Promise.all(
      files.map(async (f) => {
        const fileInfo: ModelFileInfo | undefined = await Utility.getModelFileInfo(f.path);
        if (fileInfo) {
          if (!type || type === fileInfo.type) {
            items.push({
              label: path.basename(fileInfo.filePath),
              description: fileInfo.id,
              data: fileInfo.filePath,
            });
          }
        }
      }),
    );
    if (items.length === 0) {
      UI.showNotification(MessageType.Warn, UIConstants.MODELS_NOT_FOUND_MSG);
      return undefined;
    }
    const selected: Array<QuickPickItemWithData<string>> | undefined = await vscode.window.showQuickPick(items, {
      placeHolder: label,
      ignoreFocusOut: true,
      canPickMany: true,
      matchOnDescription: true,
    });
    if (!selected || selected.length === 0) {
      throw new UserCancelledError(label);
    }
    return selected.map((s) => s.data);
  }

  /**
   * ensure files saved
   * @param label label
   * @param files file list
   */
  public static async ensureFilesSaved(label: string, files: string[]): Promise<void> {
    const dirtyFiles: vscode.TextDocument[] = vscode.workspace.textDocuments.filter((f) => f.isDirty);
    const unsaved: vscode.TextDocument[] = dirtyFiles.filter((f) => files.some((file) => file === f.fileName));
    if (unsaved.length === 0) {
      return;
    }
    const nameList: string = unsaved.map((f) => path.basename(f.fileName)).toString();
    const message = `${UIConstants.ASK_TO_SAVE_MSG} [${nameList}]`;
    const choice: string | undefined = await vscode.window.showWarningMessage(
      message,
      ChoiceType.Yes,
      ChoiceType.Cancel,
    );
    if (choice === ChoiceType.Yes) {
      await Promise.all(unsaved.map((f) => f.save()));
    } else {
      throw new UserCancelledError(label);
    }
  }

  private constructor() {}
}
