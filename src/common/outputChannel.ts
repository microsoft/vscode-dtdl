// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as vscode from "vscode";

import * as constants from "./constants";

export const pnpChannel = {
  channel: vscode.window.createOutputChannel(constants.EXTENSION_NAME),

  start(component: string, message: string) {
    this.channel.appendLine(`[Start][${component}] ${message}`);
  },

  end(component: string, message: string) {
    this.channel.appendLine(`[Complete][${component}] ${message}`);
  },

  warn(component: string, message: string) {
    this.channel.appendLine(`[Warn][${component}] ${message}`);
  },

  error(component: string, message: string) {
    this.channel.appendLine(`[Error][${component}] ${message}`);
  },

  info(message: string) {
    this.channel.appendLine(message);
  },

  show() {
    this.channel.show();
  },

  hide() {
    this.channel.hide();
  }
};
