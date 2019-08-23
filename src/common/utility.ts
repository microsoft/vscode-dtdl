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
    await fs.writeFile(filePath, content, { encoding: Constants.UTF8 });
  }

  public static replaceAll(str: string, replacement: Map<string, string>, caseInsensitive: boolean = false): string {
    const flag: string = caseInsensitive ? "ig" : "g";
    const keys = Array.from(replacement.keys());
    const pattern: RegExp = new RegExp(keys.join("|"), flag);
    return str.replace(pattern, (matched) => {
      const value: string | undefined = replacement.get(matched);
      return value ? value : matched;
    });
  }

  public static async validateModelName(name: string, type: ModelType, folder?: string): Promise<string | undefined> {
    if (!name || name.trim() === "") {
      return "Name could not be empty";
    }
    if (!Constants.MODEL_NAME_REGEX.test(name)) {
      return `Name can only contain ${Constants.MODEL_NAME_REGEX_DESCRIPTION}`;
    }

    if (folder) {
      const filename = DeviceModelManager.generateModelFilename(name, type);
      if (await fs.pathExists(path.join(folder, filename))) {
        return `${type} ${name} already exists in folder ${folder}`;
      }
    }
    return undefined;
  }
}
