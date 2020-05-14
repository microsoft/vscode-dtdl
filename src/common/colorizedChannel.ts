// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as vscode from "vscode";
import { Constants } from "./constants";

/**
 * Output channel with colorized message
 */
export class ColorizedChannel {
  /**
   * format message for operation or error
   * @param operation operation
   * @param error error
   */
  public static formatMessage(operation: string, error?: Error): string {
    if (error) {
      const message: string = operation.charAt(0).toLowerCase() + operation.slice(1);
      return `Fail to ${message}. Error: ${error.message}`;
    } else {
      return `${operation} successfully`;
    }
  }

  /**
   * create tag of component name
   * @param name component name
   */
  private static createTag(name: string | undefined): string {
    return name ? `[${name}]` : Constants.EMPTY_STRING;
  }

  private channel: vscode.OutputChannel;
  constructor(name: string) {
    this.channel = vscode.window.createOutputChannel(name);
  }

  /**
   * print message of user operation start
   * @param operation operation
   * @param component component name
   */
  public start(operation: string, component?: string): void {
    const tag: string = ColorizedChannel.createTag(component);
    this.channel.appendLine(`[Start]${tag} ${operation}`);
  }

  /**
   * print message of user operation end
   * @param operation operation
   * @param component component name
   */
  public end(operation: string, component?: string): void {
    const tag: string = ColorizedChannel.createTag(component);
    this.channel.appendLine(`[Done]${tag} ${ColorizedChannel.formatMessage(operation)}`);
  }

  /**
   * print information message (color: default)
   * @param message message
   */
  public info(message: string): void {
    this.channel.appendLine(message);
  }

  /**
   * print warning message (color: yellow)
   * @param message message
   * @param component component name
   */
  public warn(message: string, component?: string): void {
    const tag: string = ColorizedChannel.createTag(component);
    this.channel.appendLine(`[Warn]${tag} ${message}`);
  }

  /**
   * print error message or operation failure (color: red)
   * @param operation operation
   * @param component component name
   * @param error error
   */
  public error(operation: string, component?: string, error?: Error): void {
    const tag: string = ColorizedChannel.createTag(component);
    const message: string = error ? ColorizedChannel.formatMessage(operation, error) : operation;
    this.channel.appendLine(`[Error]${tag} ${message}`);
  }

  /**
   * show channel
   */
  public show(): void {
    this.channel.show();
  }

  /**
   * dispose
   */
  public dispose(): void {
    if (this.channel) {
      this.channel.dispose();
    }
  }
}
