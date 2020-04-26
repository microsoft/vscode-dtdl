// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

/**
 * Message for diagnostic result
 */
export enum DiagnosticMessage {
  MissingType = "@type is missing.",
  InvalidType = "Invalid type. Valid types:",
  UnexpectedProperty = "is unexpected.",
  MissingRequiredProperties = "Missing required properties:",
  EmptyObject = "Object is empty.",
  EmptyString = "String is empty.",
  EmptyArray = "Array is empty.",
  NotObjectType = "Object is not expected.",
  NotArrayType = "Array is not expected.",
  ValueNotString = "Value is not string.",
  ValueNotInteger = "Value is not integer.",
  LessThanMinLength = "String length is less than the minimum length of",
  GreaterThanMaxLength = "String is greater than the maximum length of",
  LessThanMinCount = "Array size is less than the minimum count of",
  GreaterThanMaxCount = "Array size is greater than maximum count of",
  LessThanMinValue = "Number is less than the minimum value of",
  GreaterThanMaxValue = "Number is greater than the maximum value of",
  NotMatchPattern = "String does not match the pattern of",
  ConflictType = "Conflict type:",
  CoTypeNotAllowed = "Co-type is not allowed. Only Telemetry, Property, Relationship support co-type.",
  DuplicateItem = "has been assigned to another item.",
  InvalidValue = "Invalid value. Valid values:",
  InvalidContext = "Invalid context of DigitalTwin.",
  InvalidDtmiLength = "The maximum length of a user DTMI is 2048 characters.",
  InvalidDtmiPattern = "The pattern of DTMI is dtmi:<path>;<version>. Each path segment is a non-empty string containing only letters, digits, and underscores.",
}

/**
 * Constants for DigitalTwin IntelliSense
 */
export class DigitalTwinConstants {
  public static readonly DTDL_MIN_VERSION = 2;
  public static readonly DTDL_CURRENT_VERSION = 2;
  public static readonly DTMI_MAX_LENGTH = 2048;
  public static readonly LANGUAGE_ID = "json";
  public static readonly LANG_STRING = "langString";
  public static readonly IRI = "IRI";
  public static readonly ENTRY = "@entry";
  public static readonly TYPE = "@type";
  public static readonly CONTEXT = "@context";
  public static readonly LINE_FEED = "\n";
  public static readonly DEFAULT_DELIMITER = ",";
  public static readonly SCHEMA_DELIMITER = "#";
  public static readonly DTMI_PATH_DELIMITER = ":";
  public static readonly DTMI_VERSION_DELIMITER = ";";
  public static readonly REQUIRED_PROPERTY_LABEL = "(required)";
  public static readonly WORD_STOP = ' \t\n\r\v":{[,';
  public static readonly CONTEXT_REGEX = /^dtmi:dtdl:context;(\d+)$/;
  public static readonly DTMI_REGEX = /^dtmi:[A-Za-z](?:[A-Za-z0-9_]*[A-Za-z0-9])?(?::[A-Za-z](?:[A-Za-z0-9_]*[A-Za-z0-9])?)*;[1-9][0-9]{0,8}$/;

  public static readonly NAME = "name";
  public static readonly SCHEMA = "schema";
  public static readonly CONTENTS = "contents";
  public static readonly IMPLEMENTS = "implements";
  public static readonly INTERFACE_SCHEMA = "interfaceSchema";
  public static readonly RESERVED = "@";
  public static readonly ID = "@id";
  public static readonly INTERFACE_SCHEMA_NODE = "InterfaceInstance/schema";
  public static readonly IOT_MODEL_LABEL = "IoTModel";
  public static readonly CONTEXT_TEMPLATE = "http://azureiot.com/v1/contexts/IoTModel.json";
  public static readonly SUPPORT_SEMANTIC_TYPES = new Set<string>(["Telemetry", "Property"]);
}
