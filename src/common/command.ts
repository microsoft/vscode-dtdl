// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

export class Command {
  public static readonly CREATE_INTERFACE = new Command("azure-digital-twins.createInterface", "Create Interface");
  public static readonly CREATE_CAPABILITY_MODEL = new Command(
    "azure-digital-twins.createCapabilityModel",
    "Create Capability Model",
  );
  public static readonly OPEN_REPOSITORY = new Command("azure-digital-twins.openRepository", "Open Model Repository");
  public static readonly SIGN_OUT_REPOSITORY = new Command(
    "azure-digital-twins.signOutRepository",
    "Sign out Model Repository",
  );
  public static readonly SUBMIT_FILES = new Command(
    "azure-digital-twins.submitFiles",
    "Submit Files to Model Repository",
  );
  private constructor(public readonly id: string, public readonly description: string) {}
}
