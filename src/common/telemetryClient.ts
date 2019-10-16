// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as vscode from "vscode";
import TelemetryReporter from "vscode-extension-telemetry";

const MILLISECOND = 1000;
const PACKAGE_JSON_PATH = "./package.json";
const INTERNAL_USER_DOMAIN = "microsoft.com";

export enum TelemetryResult {
  Succeeded = "Succeeded",
  Failed = "Failed",
  Cancelled = "Cancelled",
}

export interface TelemetryContext {
  start: number;
  properties: { [key: string]: string };
  measurements: { [key: string]: number };
}

export class TelemetryClient {
  private static validatePackageJSON(packageJSON: any): boolean {
    return packageJSON.name && packageJSON.publisher && packageJSON.version && packageJSON.aiKey;
  }

  private static isInternalUser(): boolean {
    const userDomain: string = process.env.USERDNSDOMAIN ? process.env.USERDNSDOMAIN.toLowerCase() : "";
    return userDomain.endsWith(INTERNAL_USER_DOMAIN);
  }

  private client: TelemetryReporter | undefined;
  private isInternal: boolean = false;
  constructor(context: vscode.ExtensionContext) {
    const packageJSON = require(context.asAbsolutePath(PACKAGE_JSON_PATH));
    if (!packageJSON) {
      return;
    }
    if (!TelemetryClient.validatePackageJSON(packageJSON)) {
      return;
    }

    this.client = new TelemetryReporter(
      `${packageJSON.publisher}.${packageJSON.name}`,
      packageJSON.version,
      packageJSON.aiKey,
    );
    this.isInternal = TelemetryClient.isInternalUser();
  }

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

  public createContext(): TelemetryContext {
    const context: TelemetryContext = { start: Date.now(), properties: {}, measurements: {} };
    context.properties.isInternal = this.isInternal.toString();
    context.properties.result = TelemetryResult.Succeeded;
    return context;
  }

  public setErrorContext(context: TelemetryContext, error: Error): void {
    context.properties.result = TelemetryResult.Failed;
    context.properties.error = error.name;
    context.properties.errorMessage = error.message;
  }

  public setCancelContext(context: TelemetryContext): void {
    context.properties.result = TelemetryResult.Cancelled;
  }

  public closeContext(context: TelemetryContext) {
    context.measurements.duration = (Date.now() - context.start) / MILLISECOND;
  }

  public dispose(): void {
    if (this.client) {
      this.client.dispose();
    }
  }
}
