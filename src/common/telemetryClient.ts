// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as fs from "fs";
import * as vscode from "vscode";
import TelemetryReporter from "vscode-extension-telemetry";

/**
 * Operation result of telemetry
 */
export enum TelemetryResult {
  Succeeded = "Succeeded",
  Failed = "Failed",
  Cancelled = "Cancelled",
}

/**
 * Context of telemetry
 */
export interface TelemetryContext {
  start: number;
  properties: { [key: string]: string };
  measurements: { [key: string]: number };
}

/**
 * Telemetry client
 */
export class TelemetryClient {
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
      this.client.sendTelemetryEvent(eventName, telemetryContext.properties, telemetryContext.measurements);
    } else {
      this.client.sendTelemetryEvent(eventName);
    }
  }

  /**
   * create telemetry context
   */
  public createContext(): TelemetryContext {
    const context: TelemetryContext = { start: Date.now(), properties: {}, measurements: {} };
    context.properties.isInternal = this.isInternal.toString();
    context.properties.result = TelemetryResult.Succeeded;
    return context;
  }

  /**
   * set telemetry context as error
   * @param context telemetry context
   * @param error error
   */
  public setErrorContext(context: TelemetryContext, error: Error): void {
    context.properties.result = TelemetryResult.Failed;
    context.properties.error = error.name;
    context.properties.errorMessage = error.message;
  }

  /**
   * set telemetry context as cancel
   * @param context telemetry context
   */
  public setCancelContext(context: TelemetryContext): void {
    context.properties.result = TelemetryResult.Cancelled;
  }

  /**
   * close telemetry context
   * @param context telemetry context
   */
  public closeContext(context: TelemetryContext) {
    context.measurements.duration = (Date.now() - context.start) / 1000;
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
