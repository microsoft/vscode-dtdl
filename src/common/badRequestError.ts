// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

export class BadRequestError extends Error {
  constructor(message: string) {
    super(`Bad request: ${message}`);
    this.name = "BadRequestError";
  }
}
