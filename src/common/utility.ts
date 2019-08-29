// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as fs from "fs-extra";
import * as path from "path";
import { DeviceModelManager, ModelType } from "../deviceModel/deviceModelManager";
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
    await fs.writeFile(filePath, JSON.stringify(jsonContent, null, 2), { encoding: Constants.UTF8 });
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
      const filename: string = DeviceModelManager.generateModelFilename(name, type);
      if (await fs.pathExists(path.join(folder, filename))) {
        return `${type} ${name} already exists in folder ${folder}`;
      }
    }
    return undefined;
  }

  public static async validateConnctionString(name: string): Promise<string | undefined> {
    if (!name || name.trim() === "") {
      return `Connection string ${Constants.NOT_EMPTY_MSG}`;
    }
    return undefined;
  }

  public static enforceHttps(url: string): string {
    return Constants.URL_PROTOCAL_REGEX.test(url)
      ? url.replace(Constants.URL_PROTOCAL_REGEX, Constants.HTTPS_PROTOCAL)
      : Constants.HTTPS_PROTOCAL + url;
  }

  public static async createModelFile(folder: string, modelId: string, content: any): Promise<void> {
    const replacement = new Map<string, string>();
    replacement.set(":", "_");
    const modelName: string = Utility.replaceAll(modelId, replacement);
    // TODO:(erichen): check if @type works
    const type: ModelType = DeviceModelManager.convertToModelType(content[Constants.SCHEMA_TYPE_KEY]);
    if (!type) {
      throw new Error("Invalid model type");
    }

    let candidate: string = DeviceModelManager.generateModelFilename(modelName, type);
    let counter: number = 0;
    while (true) {
      if (!(await fs.pathExists(path.join(folder, candidate)))) {
        break;
      }
      counter++;
      candidate = DeviceModelManager.generateModelFilename(`${modelName}_${counter}`, type);
    }

    await fs.writeFile(path.join(folder, candidate), JSON.stringify(content, null, 2), { encoding: Constants.UTF8 });
  }

  private constructor() {}
}
