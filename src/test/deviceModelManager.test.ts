// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from "path";
import { ColorizedChannel } from "../common/colorizedChannel";
import { Constants } from "../common/constants";
import { ProcessError } from "../common/processError";
import { Utility } from "../common/utility";
import { DeviceModelManager, ModelType } from "../deviceModel/deviceModelManager";
import { UI } from "../view/ui";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const vscode = require("../../__mocks__/vscode");

jest.mock("../common/colorizedChannel");
jest.mock("../common/utility");
jest.mock("../view/ui");

describe("Device model manager", () => {
  const folder = "root";
  const template = "template";
  const context = vscode.ExtensionContext;
  const channel = new ColorizedChannel(Constants.CHANNEL_NAME);
  const manager = new DeviceModelManager(context, channel);

  UI.selectRootFolder = jest.fn().mockResolvedValue(folder);
  UI.inputModelName = jest.fn().mockResolvedValue("test");
  UI.selectTemplateFile = jest.fn().mockResolvedValue(template);

  test("create interface successfully", async () => {
    await manager.createModel(ModelType.Interface);
    expect(UI.openAndShowTextDocument).toHaveBeenCalledWith(path.join(folder, "test.json"));
  });

  test("create interface with error", async () => {
    Utility.createFileFromTemplate = jest.fn().mockRejectedValueOnce(new Error());
    await expect(manager.createModel(ModelType.Interface)).rejects.toThrow(ProcessError);
  });
});
