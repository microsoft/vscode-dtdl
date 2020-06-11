// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { ColorizedChannel } from "../common/colorizedChannel";
import { Constants } from "../common/constants";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const vscode = require("../../__mocks__/vscode");

describe("Colorized channel", () => {
  const channel = new ColorizedChannel(Constants.CHANNEL_NAME);
  const operation = "Test";
  const message = "mock";

  afterEach(() => {
    vscode.OutputChannel.appendLine.mockClear();
  });

  test("format success message", () => {
    expect(ColorizedChannel.formatMessage(operation)).toBe("Test successfully");
  });

  test("format failure message", () => {
    expect(ColorizedChannel.formatMessage(operation, new Error(message))).toBe("Fail to test. Error: mock");
  });

  test("print operation start", () => {
    channel.start(operation);
    expect(vscode.OutputChannel.appendLine).toHaveBeenCalledWith("[Start] Test");
  });

  test("print operation successfully end", () => {
    channel.end(operation, Constants.DEVICE_MODEL_COMPONENT);
    expect(vscode.OutputChannel.appendLine).toHaveBeenCalledWith("[Done][Device Model] Test successfully");
  });

  test("print info message", () => {
    channel.info(operation);
    expect(vscode.OutputChannel.appendLine).toHaveBeenCalledWith("Test");
  });

  test("print warn message", () => {
    channel.warn(operation);
    expect(vscode.OutputChannel.appendLine).toHaveBeenCalledWith("[Warn] Test");
  });

  test("print error message", () => {
    channel.error(message);
    expect(vscode.OutputChannel.appendLine).toHaveBeenCalledWith("[Error] mock");
  });

  test("print operation fail to end", () => {
    channel.error(operation, Constants.DEVICE_MODEL_COMPONENT, new Error(message));
    expect(vscode.OutputChannel.appendLine).toHaveBeenCalledWith("[Error][Device Model] Fail to test. Error: mock");
  });

  test("show channel", () => {
    channel.show();
    expect(vscode.OutputChannel.show).toHaveBeenCalled();
  });

  test("dispose channel", () => {
    channel.dispose();
    expect(vscode.OutputChannel.dispose).toHaveBeenCalled();
  });
});
