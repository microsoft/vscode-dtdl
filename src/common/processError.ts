// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

export class ProcessError extends Error {
  constructor(message: string, public readonly component: string) {
    super(message);
    this.name = "ProcessError";

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ProcessError);
    }
  }
}
