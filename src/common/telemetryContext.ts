// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { UserCancelledError } from "./userCancelledError";

/**
 * Operation result
 */
enum OperationResult {
  Success = "Succeeded",
  Fail = "Failed",
  Cancel = "Cancelled",
}

/**
 * Telemetry context
 */
export class TelemetryContext {
  /**
   * start a new context
   */
  public static startNew(): TelemetryContext {
    return new TelemetryContext();
  }

  public properties: { [key: string]: string };
  public measurements: { [key: string]: number };

  private start: number;
  private constructor() {
    this.start = Date.now();
    this.properties = {};
    this.measurements = {};
  }

  /**
   * set property
   * @param name property name
   * @param value property value
   */
  public setProperty(name: string, value: string): void {
    this.properties[name] = value;
  }

  /**
   * set error
   * @param error error
   */
  public setError(error: Error): void {
    if (error instanceof UserCancelledError) {
      this.properties.result = OperationResult.Cancel;
    } else {
      this.properties.result = OperationResult.Fail;
      this.properties.error = error.name;
      this.properties.errorMessage = error.message;
    }
  }

  /**
   * end the context
   */
  public end(): void {
    if (!this.properties.result) {
      this.properties.result = OperationResult.Success;
    }
    this.measurements.duration = (Date.now() - this.start) / 1000;
  }
}
