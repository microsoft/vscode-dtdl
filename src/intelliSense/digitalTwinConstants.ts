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
  ShorterThanMinLength = "String is shorter than the minimum length of",
  LongerThanMaxLength = "String is longer than the maximum length of",
  NotMatchPattern = "String does not match the pattern of",
  NotObjectType = "Object is not expected.",
  EmptyObject = "Object is empty.",
  EmptyString = "String is empty.",
  EmptyArray = "Array is empty.",
  TooFewItems = "Array has too few items. Minimum count is",
  TooManyItems = "Array has too many items. Maximum count is",
  DuplicateItem = "has been assigned to another item.",
  InvalidEnum = "Invalid value. Valid values:",
  InvalidContext = "Invalid context of DigitalTwin.",
  ConflictType = "Conflict type:",
  ValueNotString = "Value is not string.",
}

/**
 * Constants for DigitalTwin IntelliSense
 */
export class DigitalTwinConstants {
  public static readonly DTDL_MIN_VERSION = 2;
  public static readonly DTDL_CURRENT_VERSION = 2;
  public static readonly LANGUAGE_ID = "json";
  public static readonly ENTRY_NODE = "@entry";
  public static readonly CONTEXT_NODE = "@context";
  public static readonly CONTEXT_REGEX = /^dtmi:dtdl:context;(\d+)$/;
  public static readonly LINE_FEED = "\n";
  public static readonly WORD_STOP = ' \t\n\r\v":{[,';
  public static readonly REQUIRED_PROPERTY_LABEL = "(required)";

  public static readonly NAME = "name";
  public static readonly SCHEMA = "schema";
  public static readonly CONTENTS = "contents";
  public static readonly IMPLEMENTS = "implements";
  public static readonly INTERFACE_SCHEMA = "interfaceSchema";
  public static readonly RESERVED = "@";
  public static readonly ID = "@id";
  public static readonly TYPE = "@type";
  public static readonly INTERFACE_NODE = "Interface";
  public static readonly CAPABILITY_MODEL_NODE = "CapabilityModel";
  public static readonly SCHEMA_NODE = "Schema";
  public static readonly UNIT_NODE = "Unit";
  public static readonly INTERFACE_SCHEMA_NODE = "InterfaceInstance/schema";
  public static readonly IOT_MODEL_LABEL = "IoTModel";
  public static readonly CONTEXT_TEMPLATE = "http://azureiot.com/v1/contexts/IoTModel.json";
  public static readonly SUPPORT_SEMANTIC_TYPES = new Set<string>(["Telemetry", "Property"]);
}
