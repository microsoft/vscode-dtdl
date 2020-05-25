// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Utility } from "../common/utility";
import { Constants } from "../common/constants";
import { ModelType } from "../deviceModel/deviceModelManager";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { readFile, writeJson, pathExists } = require("fs-extra");

jest.mock("fs-extra");

describe("Utility", () => {
  const folder = "root";
  const name = "test";
  const modelId = "urn:model:id:1";
  const replacement = new Map<string, string>();
  replacement.set(Constants.MODEL_ID_PLACEHOLDER, modelId);

  test("create file from template", async () => {
    const templatePath = "templatePath";
    const filePath = "filePath";
    const writeOptions = {
      spaces: Constants.JSON_SPACE,
      encoding: Constants.UTF8
    };
    const template = `{"@id": "${Constants.MODEL_ID_PLACEHOLDER}"}`;
    readFile.mockResolvedValueOnce(template);
    await Utility.createFileFromTemplate(templatePath, filePath, replacement);
    expect(writeJson).toHaveBeenCalledWith(filePath, { "@id": modelId }, writeOptions);
  });

  test("replace all when multiple matched", () => {
    const template = Constants.MODEL_ID_PLACEHOLDER + "," + Constants.MODEL_ID_PLACEHOLDER;
    expect(Utility.replaceAll(template, replacement)).toBe(modelId + "," + modelId);
  });

  test("replace all when not matched", () => {
    const template = "{digitalTwinIdentifier}";
    expect(Utility.replaceAll(template, replacement)).toBe(template);
  });

  test("replace all with multiple pattern", () => {
    const secondKey = "{foo}";
    const secondValue = "bar";
    replacement.set(secondKey, secondValue);
    const template = Constants.MODEL_ID_PLACEHOLDER + "," + secondKey;
    expect(Utility.replaceAll(template, replacement)).toBe(modelId + "," + secondValue);
  });

  test("validate model name successfully", async () => {
    pathExists.mockResolvedValueOnce(false);
    const message = await Utility.validateModelName(name, ModelType.Interface, folder);
    expect(message).toBeUndefined();
  });

  test("validate model name when it is empty", async () => {
    const message = await Utility.validateModelName("", ModelType.Interface, folder);
    expect(message).toBe("Name " + Constants.NOT_EMPTY_MSG);
  });

  test("validate model name when it is not allowed", async () => {
    const message = await Utility.validateModelName("my-interface", ModelType.Interface, folder);
    expect(message).toBe("Name can only contain " + Constants.MODEL_NAME_REGEX_DESCRIPTION);
  });
});
