// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

export class UserCancelledError extends Error {
  constructor(operation?: string) {
    const message = operation ? ` on [${operation}]` : "";
    super("User cancelled the operation" + message);
    this.name = "UserCancelledError";
  }
}
