// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

export class Constants {
  public static readonly EXTENSION_NAME = "azure-digital-twins";
  public static readonly CHANNEL_NAME = "IoT Plug and Play";
  public static readonly UTF8 = "utf8";
  public static readonly JSON_SPACE = 2;
  public static readonly NOT_FOUND_CODE = 404;
  public static readonly DEFAULT_PAGE_SIZE = 50;
  public static readonly RESOURCE_FOLDER = "resources";
  public static readonly TEMPLATE_FOLDER = "templates";
  public static readonly SAMPLE_FILE_NAME = "sample";

  public static readonly DEVICE_MODEL_COMPONENT = "Device Model";
  public static readonly MODEL_REPOSITORY_COMPONENT = "Model Repository";
  public static readonly MODEL_REPOSITORY_CONNECTION_KEY = "ModelRepositoryConnectionKey";
  public static readonly MODEL_REPOSITORY_API_VERSION = "2019-07-01-Preview";
  public static readonly URL_PROTOCAL_REGEX = new RegExp("^[a-zA-Z]+://");
  public static readonly HTTPS_PROTOCAL = "https://";
  public static readonly MODEL_NAME_REGEX = new RegExp("^[a-zA-Z_][a-zA-Z0-9_]*$");
  public static readonly MODEL_NAME_REGEX_DESCRIPTION = "alphanumeric and underscore, not start with number";
  public static readonly DIGITAL_TWIN_ID_PLACEHOLDER = "{DigitalTwinIdentifier}";
  public static readonly SCHEMA_ID_KEY = "@id";
  public static readonly SCHEMA_TYPE_KEY = "@type";
  public static readonly SCHEMA_CONTEXT_KEY = "@context";

  public static readonly EXTENSION_ACTIVATED_MSG = "extensionActivated";
  public static readonly NOT_EMPTY_MSG = "could not be empty";
  public static readonly CONNECTION_STRING_NOT_FOUND_MSG =
    "Company repository connection string is not found. Please sign out and sign in with a valid connection string";
  public static readonly PUBLIC_REPOSITORY_URL_NOT_FOUND_MSG = "Public repository url is not found";
  public static readonly CONNECTION_STRING_INVALID_FORMAT_MSG = "Invalid connection string format";
  public static readonly MODEL_TYPE_INVALID_MSG = "Invalid model type";

  public static readonly NSAT_SURVEY_URL = "https://aka.ms/vscode-azure-digital-twins-survey";
  public static readonly WEB_VIEW_PATH = "assets/modelRepository";
  public static readonly COMPANY_REPOSITORY_PAGE = "index.html";
  public static readonly PUBLIC_REPOSITORY_PAGE = "index.html?public";
  public static readonly PUBLIC_REPOSITORY_URL = "publicRepositoryUrl";
}
