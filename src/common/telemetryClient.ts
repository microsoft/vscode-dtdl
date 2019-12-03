// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as fs from "fs";
import * as vscode from "vscode";
import TelemetryReporter from "vscode-extension-telemetry";
import { TelemetryContext } from "./telemetryContext";

/**
 * Telemetry client
 */
export class TelemetryClient {
  private static readonly IS_INTERNAL = "isInternal";

  /**
   * validate content of package json
   * @param packageJSON package json
   */
  private static validatePackageJSON(packageJSON: any): boolean {
    return packageJSON.name && packageJSON.publisher && packageJSON.version && packageJSON.aiKey;
  }

  /**
   * check if it is Microsoft internal user
   */
  private static isInternalUser(): boolean {
    const userDomain: string = process.env.USERDNSDOMAIN ? process.env.USERDNSDOMAIN.toLowerCase() : "";
    return userDomain.endsWith("microsoft.com");
  }

  public extensionId: string = "";
  public extensionVersion: string = "unknown";

  private client: TelemetryReporter | undefined;
  private isInternal: boolean = false;
  constructor(context: vscode.ExtensionContext) {
    const packageJSON = JSON.parse(fs.readFileSync(context.asAbsolutePath("./package.json"), "utf8"));
    if (!packageJSON || TelemetryClient.validatePackageJSON(packageJSON)) {
      return;
    }
    this.extensionId = `${packageJSON.publisher}.${packageJSON.name}`;
    this.extensionVersion = packageJSON.version;
    this.client = new TelemetryReporter(this.extensionId, this.extensionVersion, packageJSON.aiKey);
    this.isInternal = TelemetryClient.isInternalUser();
  }

  /**
   * send event
   * @param eventName event name
   * @param telemetryContext telemetry context
   */
  public sendEvent(eventName: string, telemetryContext?: TelemetryContext): void {
    if (!this.client) {
      return;
    }
    if (telemetryContext) {
      telemetryContext.setProperty(TelemetryClient.IS_INTERNAL, this.isInternal.toString());
      this.client.sendTelemetryEvent(eventName, telemetryContext.properties, telemetryContext.measurements);
    } else {
      const properties = { [TelemetryClient.IS_INTERNAL]: this.isInternal.toString() };
      this.client.sendTelemetryEvent(eventName, properties);
    }
  }

  /**
   * dispose telemetry client
   */
  public dispose(): void {
    if (this.client) {
      this.client.dispose();
    }
  }
}
