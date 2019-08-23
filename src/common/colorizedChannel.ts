// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as vscode from "vscode";

export class ColorizedChannel {
  private static buildTag(name: string | undefined): string {
    return name ? `[${name}]` : "";
  }

  private channel: vscode.OutputChannel;

  constructor(name: string) {
    this.channel = vscode.window.createOutputChannel(name);
  }

  public start(message: string, component?: string): void {
    const tag = ColorizedChannel.buildTag(component);
    this.channel.appendLine(`[Start]${tag} ${message}`);
  }

  public end(message: string, component?: string): void {
    const tag = ColorizedChannel.buildTag(component);
    this.channel.appendLine(`[Done]${tag} ${message}`);
  }

  public warn(message: string, component?: string): void {
    const tag = ColorizedChannel.buildTag(component);
    this.channel.appendLine(`[Warn]${tag} ${message}`);
  }

  public error(message: string, component?: string): void {
    const tag = ColorizedChannel.buildTag(component);
    this.channel.appendLine(`[Error]${tag} ${message}`);
  }

  public info(message: string): void {
    this.channel.appendLine(message);
  }

  public show(): void {
    this.channel.show();
  }
}
