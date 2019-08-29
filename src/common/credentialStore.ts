// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as keytar from "keytar";
import { Constants } from "./constants";

export class CredentialStore {
  public static async get(name: string): Promise<string | null> {
    return keytar.getPassword(Constants.EXTENSION_NAME, name);
  }

  public static async set(name: string, value: string): Promise<void> {
    await keytar.setPassword(Constants.EXTENSION_NAME, name, value);
  }

  public static async delete(name: string): Promise<boolean> {
    return keytar.deletePassword(Constants.EXTENSION_NAME, name);
  }

  private constructor() {}
}
