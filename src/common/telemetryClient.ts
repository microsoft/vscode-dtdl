// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as fs from "fs";
import * as vscode from "vscode";
import TelemetryReporter from "vscode-extension-telemetry";
import { Constants } from "./constants";
import { TelemetryContext } from "./telemetryContext";

/**
 * Telemetry client
 */
export class TelemetryClient {
  private static readonly IS_INTERNAL = "isInternal";

  /**
   * check if it is a valid package json
   * @param packageJSON package json
   */
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  private static isValidPackageJSON(packageJSON: any): boolean {
    return packageJSON.name && packageJSON.publisher && packageJSON.version && packageJSON.aiKey;
  }

  /**
   * check if it is Microsoft internal user
   */
  private static isInternalUser(): boolean {
    const userDomain: string = process.env.USERDNSDOMAIN
      ? process.env.USERDNSDOMAIN.toLowerCase()
      : Constants.EMPTY_STRING;
    return userDomain.endsWith("microsoft.com");
  }

  public extensionId: string = Constants.EMPTY_STRING;
  public extensionVersion = "unknown";

  private client: TelemetryReporter | undefined;
  private isInternal = false;
  constructor(context: vscode.ExtensionContext) {
    const packageJSON = JSON.parse(fs.readFileSync(context.asAbsolutePath("./package.json"), "utf8"));
    if (!packageJSON || !TelemetryClient.isValidPackageJSON(packageJSON)) {
      return;
    }
    this.extensionId = `${packageJSON.publisher}.${packageJSON.name}`;
    this.extensionVersion = packageJSON.version;
    this.client = new TelemetryReporter(this.extensionId, this.extensionVersion, packageJSON.aiKey, true);
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
    if (!telemetryContext) {
      const properties = { [TelemetryClient.IS_INTERNAL]: this.isInternal.toString() };
      this.client.sendTelemetryEvent(eventName, properties);
      return;
    }

    telemetryContext.properties[TelemetryClient.IS_INTERNAL] = this.isInternal.toString();

    if (telemetryContext.succeeded()) {
      this.client.sendTelemetryEvent(eventName, telemetryContext.properties, telemetryContext.measurements);
    } else {
      this.client.sendTelemetryErrorEvent(eventName, telemetryContext.properties, telemetryContext.measurements, [
        "errorMessage"
      ]);
    }
  }

  /**
   * dispose
   */
  public dispose(): void {
    if (this.client) {
      this.client.dispose();
    }
  }
}
