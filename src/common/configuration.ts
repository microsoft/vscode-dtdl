// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as vscode from "vscode";
import { Constants } from "./constants";

export class Configuration {
  public static getProperty<T>(name: string): T | undefined {
    return Configuration.instance.get<T>(name);
  }

  public static async setGlobalProperty(name: string, value: any): Promise<void> {
    await Configuration.instance.update(name, value, true);
  }

  public static async setWorkspaceProperty(name: string, value: any): Promise<void> {
    await Configuration.instance.update(name, value, false);
  }

  private static readonly instance: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(
    Constants.EXTENSION_NAME,
  );
  private constructor() {}
}
