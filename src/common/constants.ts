// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

export class Constants {
  public static readonly CHANNEL_NAME = "IoT Plug and Play";

  public static readonly UTF8 = "utf8";
  public static readonly RESOURCE_FOLDER = "resources";
  public static readonly TEMPLATE_FOLDER = "templates";
  public static readonly SAMPLE_FILENAME = "sample";

  public static readonly DEVICE_MODEL_COMPONENT = "Device Model";
  public static readonly MODEL_REPOSITORY_COMPONENT = "Model Repository";

  public static readonly EXTENSION_ACTIVATED_MSG = "extensionActivated";

  public static readonly NSAT_SURVEY_URL = "https://aka.ms/vscode-azure-digital-twins-survey";

  public static readonly MODEL_NAME_REGEX = new RegExp("^[a-zA-Z_][a-zA-Z0-9_]*$");
  public static readonly MODEL_NAME_REGEX_DESCRIPTION = "alphanumeric and underscore, not start with number";
  public static readonly DIGITAL_TWIN_ID_PLACEHOLDER = "{DigitalTwinIdentifier}";
}
