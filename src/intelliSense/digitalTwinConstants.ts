// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

/**
 * Message for diagnostic result
 */
export enum DiagnosticMessage {
  MissingType = "@type is missing.",
  InvalidType = "Invalid type. Valid types:",
  InvalidProperty = "is not a valid property.",
  MissRequiredProperties = "Miss required properties:",
  EmptyValue = "is empty.",
  TypeNotAllowed = "is not allowed.",
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
  NestedNotAllowed = "is not allowed to be nested.",
  DuplicateElement = "has been assigned to another element.",
  InvalidValue = "Invalid value. Valid values:",
  InvalidDtmiLength = "The maximum length of DTMI is",
  InvalidDtmiPattern = "The pattern of DTMI is dtmi:<path>;<version>. Path may contain only letters, digits, underscore, and colon. Version must be numeric.",
  InvalidDtmiVersion = "Version must be no more than 9 digits and may not start with 0.",
  InvalidDtmiPath = "Path segments are separated by colons. Each path segment must be non-empty string that begins with letter and ends with letter or digit.",
}

/**
 * Constants for DigitalTwin IntelliSense
 */
export class DigitalTwinConstants {
  public static readonly DTDL_MIN_VERSION = 2;
  public static readonly DTDL_CURRENT_VERSION = 2;
  public static readonly DTMI_MAX_LENGTH = 2048;
  public static readonly PARTITION_CLASS_ID_MAX_LENGTH = 128;
  public static readonly LANGUAGE_ID = "json";
  public static readonly LANG_STRING = "langString";
  public static readonly ENTRY = "@entry";
  public static readonly ID = "@id";
  public static readonly TYPE = "@type";
  public static readonly CONTEXT = "@context";
  public static readonly DUMMY = "@dummy";
  public static readonly NAME_PROPERTY = "name";
  public static readonly UNIT_PROPERTY = "unit";
  public static readonly TARGET_PROPERTY = "target";
  public static readonly ENUM_VALUE_PROPERTY = "enumValue";
  public static readonly VALUE_SCHEMA_PROPERTY = "valueSchema";
  public static readonly SCHEMA_CLASS = "Schema";
  public static readonly COMPONENT_CLASS = "Component";
  public static readonly LINE_FEED = "\n";
  public static readonly DEFAULT_DELIMITER = ",";
  public static readonly SCHEMA_DELIMITER = "#";
  public static readonly DTMI_PATH_DELIMITER = ":";
  public static readonly DTMI_VERSION_DELIMITER = ";";
  public static readonly REQUIRED_PROPERTY_LABEL = "(required)";
  public static readonly WORD_STOP = ' \t\n\r\v":{[,';
  public static readonly CONTEXT_REGEX = /^dtmi:dtdl:context;(\d+)$/;
  public static readonly DTMI_PATTERN_REGEX = new RegExp("^dtmi:[A-Za-z0-9_:]*;[0-9]+$");
  public static readonly DTMI_VERSION_REGEX = new RegExp(";[1-9][0-9]{0,8}$");
  public static readonly DTMI_PATH_REGEX = new RegExp(
    "^dtmi:[A-Za-z](?:[A-Za-z0-9_]*[A-Za-z0-9])?(?::[A-Za-z](?:[A-Za-z0-9_]*[A-Za-z0-9])?)*;[1-9][0-9]{0,8}$",
  );
}
