// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from "path";
import * as vscode from "vscode";
import { ColorizedChannel } from "../common/colorizedChannel";
import { Constants } from "../common/constants";
import { ProcessError } from "../common/processError";
import { Utility } from "../common/utility";
import { MessageType, UI } from "../views/ui";
import { UIConstants } from "../views/uiConstants";

export enum ModelType {
  Interface = "Interface",
  CapabilityModel = "Capability Model",
}

export class DeviceModelManager {
  public static generateModelId(name: string): string {
    return `urn:{your name}:${name}:1`;
  }

  public static generateModelFilename(name: string, type: ModelType): string {
    const fileType: string = type.replace(/\s+/g, "").toLowerCase();
    return `${name}.${fileType}.json`;
  }

  public static getTemplateFilename(type: ModelType): string {
    return DeviceModelManager.generateModelFilename(Constants.SAMPLE_FILENAME, type);
  }

  constructor(private readonly context: vscode.ExtensionContext, private readonly outputChannel: ColorizedChannel) {}

  public async createModel(type: ModelType): Promise<void> {
    const folder: string = await UI.selectRootFolder(UIConstants.SELECT_ROOT_FOLDER_LABEL);
    const name: string = await UI.inputModelName(UIConstants.INPUT_MODEL_NAME_LABEL, type, folder);
    const model: string = `${type} ${name}`;

    this.outputChannel.start(`Create ${model} in folder ${folder}`, Constants.DEVICE_MODEL_COMPONENT);
    let filePath: string;
    try {
      filePath = await this.doCreateModel(type, folder, name);
    } catch (error) {
      const errorMessage = `Fail to create ${model}. Error: ${error.message}`;
      throw new ProcessError(errorMessage, Constants.DEVICE_MODEL_COMPONENT);
    }

    const message = `${model} is created successfully`;
    await UI.openAndShowTextDocument(filePath);
    UI.showNotification(MessageType.Info, message);
    this.outputChannel.end(message, Constants.DEVICE_MODEL_COMPONENT);
  }

  private async doCreateModel(type: ModelType, folder: string, name: string): Promise<string> {
    const modelId = DeviceModelManager.generateModelId(name);
    const filePath = path.join(folder, DeviceModelManager.generateModelFilename(name, type));
    const templatePath = this.context.asAbsolutePath(
      path.join(Constants.RESOURCE_FOLDER, Constants.TEMPLATE_FOLDER, DeviceModelManager.getTemplateFilename(type)),
    );
    const replacement = new Map<string, string>();
    replacement.set(Constants.DIGITAL_TWIN_ID_PLACEHOLDER, modelId);

    await Utility.createFileFromTemplate(templatePath, filePath, replacement);
    return filePath;
  }
}
