// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as vscode from "vscode";

export class ColorizedChannel {
  public static formatMessage(operation: string, error?: Error): string {
    if (error) {
      const message: string = operation.charAt(0).toLowerCase() + operation.slice(1);
      return `Fail to ${message}. Error: ${error.message}`;
    } else {
      return `${operation} successfully`;
    }
  }

  private static buildTag(name: string | undefined): string {
    return name ? `[${name}]` : "";
  }

  private channel: vscode.OutputChannel;
  constructor(name: string) {
    this.channel = vscode.window.createOutputChannel(name);
  }

  public start(operation: string, component?: string): void {
    const tag: string = ColorizedChannel.buildTag(component);
    this.channel.appendLine(`[Start]${tag} ${operation}`);
  }

  public end(operation: string, component?: string): void {
    const tag: string = ColorizedChannel.buildTag(component);
    this.channel.appendLine(`[Done]${tag} ${ColorizedChannel.formatMessage(operation)}`);
  }

  public warn(message: string, component?: string): void {
    const tag: string = ColorizedChannel.buildTag(component);
    this.channel.appendLine(`[Warn]${tag} ${message}`);
  }

  public error(operation: string, component?: string, error?: Error): void {
    const tag: string = ColorizedChannel.buildTag(component);
    const message: string = error ? ColorizedChannel.formatMessage(operation, error) : operation;
    this.channel.appendLine(`[Error]${tag} ${message}`);
  }

  public info(message: string): void {
    this.channel.appendLine(message);
  }

  public show(): void {
    this.channel.show();
  }

  public dispose(): void {
    if (this.channel) {
      this.channel.dispose();
    }
  }
}
