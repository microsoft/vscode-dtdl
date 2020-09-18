// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as glob from "glob";
import * as fs from "fs-extra";
import * as path from "path";
import { DeviceModelManager, ModelType } from "../deviceModel/deviceModelManager";
import { Constants } from "./constants";

/**
 * Common utility
 */
export class Utility {
  /**
   * create file from template with replacement
   * @param templatePath template file path
   * @param filePath target file path
   * @param replacement replacement
   */
  public static async createFileFromTemplate(
    templatePath: string,
    filePath: string,
    replacement: Map<string, string>
  ): Promise<void> {
    const template: string = await fs.readFile(templatePath, Constants.UTF8);
    const content: string = Utility.replaceAll(template, replacement);
    const jsonContent = JSON.parse(content);
    await fs.writeJson(filePath, jsonContent, { spaces: Constants.JSON_SPACE, encoding: Constants.UTF8 });
  }

  /**
   * validate DigitalTwin model name, return error message if validation fail
   * @param name model name
   * @param type model type
   * @param folder target folder
   */
  public static async validateModelName(name: string, type: ModelType, folder: string): Promise<string | undefined> {
    if (!name || !name.trim()) {
      return `Name ${Constants.NOT_EMPTY_MSG}`;
    }
    if (!Constants.MODEL_NAME_REGEX.test(name)) {
      return `Name can only contain ${Constants.MODEL_NAME_REGEX_DESCRIPTION}`;
    }
    const filename: string = DeviceModelManager.generateModelFileName(name);
    if (await fs.pathExists(path.join(folder, filename))) {
      return `${type} ${name} already exists in folder ${folder}`;
    }
    return undefined;
  }

  /**
   * list file in folder
   * @param folder folder path
   */
  public static listFile(folder: string, filePattern: string): string[] {
    return glob.sync(filePattern, { cwd: folder });
  }

  /**
   * replace all for content
   * @param str string
   * @param replacement replacement
   */
  public static replaceAll(str: string, replacement: Map<string, string>): string {
    const keys = Array.from(replacement.keys());
    const pattern = new RegExp(keys.join("|"), "g");
    return str.replace(pattern, matched => {
      const value: string | undefined = replacement.get(matched);
      return value || matched;
    });
  }

  private constructor() {}
}
