// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Constants } from "../common/constants";
import { UserCancelledError } from "../common/userCancelledError";
import { ModelType } from "../deviceModel/deviceModelManager";
import { UI, MessageType } from "../view/ui";
import { UIConstants } from "../view/uiConstants";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const vscode = require("../../__mocks__/vscode");

jest.mock("../common/utility");

describe("UI", () => {
  const label = "label";
  const name = "test";
  const defaultPath = "defaultPath";
  const secondPath = "secondPath";
  const browseQuickPickItem = {
    label: UIConstants.BROWSE_LABEL,
    description: Constants.EMPTY_STRING
  };
  const quickPickOptions = {
    placeHolder: label,
    ignoreFocusOut: true
  };
  const secondUri = {
    fsPath: secondPath
  };

  afterEach(() => {
    vscode.workspace.workspaceFolders = undefined;
  });

  test("open and show text document", async () => {
    await UI.openAndShowTextDocument(defaultPath);
    expect(vscode.commands.executeCommand).toHaveBeenCalled();
    expect(vscode.window.showTextDocument).toHaveBeenCalled();
  });

  test("show noticifation with info/warn/error", () => {
    UI.showNotification(MessageType.Info, label);
    expect(vscode.window.showInformationMessage).toHaveBeenCalled();
    UI.showNotification(MessageType.Warn, label);
    expect(vscode.window.showWarningMessage).toHaveBeenCalled();
    UI.showNotification(MessageType.Error, label);
    expect(vscode.window.showErrorMessage).toHaveBeenCalled();
  });

  test("select root folder when only one folder is opened", async () => {
    vscode.workspace.workspaceFolders = [vscode.WorkspaceFolder];
    const folder: string = await UI.selectRootFolder(label);
    expect(folder).toBe(defaultPath);
  });

  test("select root folder when no folder is opened", async () => {
    vscode.window.showOpenDialog = jest.fn().mockResolvedValueOnce([secondUri]);
    const folder: string = await UI.selectRootFolder(label);
    expect(vscode.window.showQuickPick).toHaveBeenCalledWith([browseQuickPickItem], quickPickOptions);
    expect(vscode.window.showOpenDialog).toHaveBeenCalledWith({
      openLabel: label,
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false
    });
    expect(folder).toBe(secondPath);
  });

  test("select root folder when multiple folders are opened", async () => {
    vscode.workspace.workspaceFolders = [vscode.WorkspaceFolder, { uri: secondUri }];
    const folder: string = await UI.selectRootFolder(label);
    expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
      [
        {
          label: defaultPath,
          description: defaultPath
        },
        {
          label: secondPath,
          description: secondPath
        },
        browseQuickPickItem
      ],
      quickPickOptions
    );
    expect(folder).toBe(defaultPath);
  });

  test("show quick pick with cancellation", async () => {
    await expect(UI.showQuickPick(label, [])).rejects.toThrow(UserCancelledError);
  });

  test("show open dialog with cancellation", async () => {
    await expect(UI.showOpenDialog(label)).rejects.toThrow(UserCancelledError);
  });

  test("input model name", async () => {
    vscode.window.showInputBox = jest.fn().mockResolvedValueOnce(name);
    const modelName = await UI.inputModelName(label, ModelType.Interface, defaultPath);
    expect(modelName).toBe(name);
    expect(vscode.window.showInputBox).toHaveBeenCalled();
  });

  test("show input box with cancellation", async () => {
    await expect(UI.showInputBox(label, "Interface name")).rejects.toThrow(UserCancelledError);
  });
});
