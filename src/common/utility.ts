// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as fs from "fs-extra";
import * as path from "path";
import { DeviceModelManager, ModelType } from "../deviceModel/deviceModelManager";
import { ModelFileInfo } from "../modelRepository/modelRepositoryManager";
import { Constants } from "./constants";

export class Utility {
  public static async createFileFromTemplate(
    templatePath: string,
    filePath: string,
    replacement: Map<string, string>,
  ): Promise<void> {
    const template: string = await fs.readFile(templatePath, Constants.UTF8);
    const content: string = Utility.replaceAll(template, replacement);
    const jsonContent = JSON.parse(content);
    await fs.writeJson(filePath, jsonContent, { spaces: Constants.JSON_SPACE, encoding: Constants.UTF8 });
  }

  public static replaceAll(str: string, replacement: Map<string, string>, caseInsensitive: boolean = false): string {
    const flag = caseInsensitive ? "ig" : "g";
    const keys = Array.from(replacement.keys());
    const pattern = new RegExp(keys.join("|"), flag);
    return str.replace(pattern, (matched) => {
      const value: string | undefined = replacement.get(matched);
      return value ? value : matched;
    });
  }

  public static async validateModelName(name: string, type: ModelType, folder?: string): Promise<string | undefined> {
    if (!name || name.trim() === "") {
      return `Name ${Constants.NOT_EMPTY_MSG}`;
    }
    if (!Constants.MODEL_NAME_REGEX.test(name)) {
      return `Name can only contain ${Constants.MODEL_NAME_REGEX_DESCRIPTION}`;
    }

    if (folder) {
      const filename: string = DeviceModelManager.generateModelFileName(name, type);
      if (await fs.pathExists(path.join(folder, filename))) {
        return `${type} ${name} already exists in folder ${folder}`;
      }
    }
    return undefined;
  }

  public static validateNotEmpty(name: string, placeholder: string): string | undefined {
    if (!name || name.trim() === "") {
      return `${placeholder} ${Constants.NOT_EMPTY_MSG}`;
    }
    return undefined;
  }

  public static enforceHttps(url: string): string {
    return Constants.URL_PROTOCAL_REGEX.test(url)
      ? url.replace(Constants.URL_PROTOCAL_REGEX, Constants.HTTPS_PROTOCAL)
      : Constants.HTTPS_PROTOCAL + url;
  }

  public static async createModelFile(folder: string, modelId: string, content: any): Promise<void> {
    const type: ModelType = DeviceModelManager.convertToModelType(content[Constants.SCHEMA_TYPE_KEY]);
    if (!type) {
      throw new Error(Constants.MODEL_TYPE_INVALID_MSG);
    }

    const replacement = new Map<string, string>();
    replacement.set(":", "_");
    const modelName: string = Utility.replaceAll(modelId, replacement);
    let candidate: string = DeviceModelManager.generateModelFileName(modelName, type);
    let counter: number = 0;
    while (true) {
      if (!(await fs.pathExists(path.join(folder, candidate)))) {
        break;
      }
      counter++;
      candidate = DeviceModelManager.generateModelFileName(`${modelName}_${counter}`, type);
    }

    await fs.writeJson(path.join(folder, candidate), content, {
      spaces: Constants.JSON_SPACE,
      encoding: Constants.UTF8,
    });
  }

  public static async getModelFileInfo(filePath: string): Promise<ModelFileInfo | undefined> {
    const content = await fs.readJson(filePath, { encoding: Constants.UTF8 });
    const modelId: string = content[Constants.SCHEMA_ID_KEY];
    const context: string = content[Constants.SCHEMA_CONTEXT_KEY];
    const modelType: ModelType = DeviceModelManager.convertToModelType(content[Constants.SCHEMA_TYPE_KEY]);
    if (modelId && context && modelType) {
      return {
        id: modelId,
        type: modelType,
        filePath,
      };
    }
    return undefined;
  }

  public static async getJsonContent(filePath: string): Promise<any> {
    return fs.readJson(filePath, { encoding: Constants.UTF8 });
  }

  private constructor() {}
}
