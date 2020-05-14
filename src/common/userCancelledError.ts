// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Constants } from "./constants";

/**
 * Error of user cancelled operation
 */
export class UserCancelledError extends Error {
  constructor(operation?: string) {
    const message = operation ? ` [${operation}]` : Constants.EMPTY_STRING;
    super("User cancelled the operation" + message);
    this.name = "UserCancelledError";
  }
}
