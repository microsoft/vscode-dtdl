// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

/**
 * Message for diagnostic result
 */
export enum DiagnosticMessage {
  MissingType = "@type is missing.",
  InvalidType = "Invalid type. Valid types:",
  UnexpectedProperty = "is unexpected.",
  MissRequiredProperties = "Miss required properties:",
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
  DuplicateElement = "has been assigned to another element.",
  InvalidValue = "Invalid value. Valid values:",
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
  public static readonly LITERAL = "Literal";
  public static readonly ENTRY = "@entry";
  public static readonly ID = "@id";
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
}
