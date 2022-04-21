// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

/**
 * Common constants
 */
export class Constants {
  public static readonly CHANNEL_NAME = "DTDL";
  public static readonly UTF8 = "utf8";
  public static readonly EMPTY_STRING = "";
  public static readonly JSON_SPACE = 2;
  public static readonly TEMPLATE_FOLDER = "templates";
  public static readonly TEMPLATE_FILE_GLOB = "**/*.json";
  public static readonly DTDL_LANGUAGE_SERVER_ID = "dtdl-language-server";
  public static readonly DTDL_LANGUAGE_SERVER_NAME = "DTDL Language Server";
  public static readonly DTDL_LANGUAGE_SERVER_RELATIVE_PATH = "dist/main.js";

  public static readonly DEVICE_MODEL_COMPONENT = "Device Model";
  public static readonly MODEL_NAME_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;
  public static readonly MODEL_NAME_REGEX_DESCRIPTION = "alphanumeric and underscore, not start with number";
  public static readonly MODEL_ID_PLACEHOLDER = "{modelId}";
  public static readonly MODEL_NAME_PLACEHOLDER = "{modelName}";

  public static readonly EXTENSION_ACTIVATED_MSG = "extensionActivated";
  public static readonly NOT_EMPTY_MSG = "could not be empty";
}
