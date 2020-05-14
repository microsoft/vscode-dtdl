// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { ColorizedChannel } from "./colorizedChannel";

/**
 * Error of process failure
 */
export class ProcessError extends Error {
  constructor(operation: string, error: Error, public readonly component: string) {
    super(ColorizedChannel.formatMessage(operation, error));
    this.name = "ProcessError";
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ProcessError);
    }
  }
}
