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
  public static convertToModelType(name: string): ModelType {
    return ModelType[name as keyof typeof ModelType];
  }

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

    const subject = `Create ${type} ${name} in folder ${folder}`;
    this.outputChannel.start(subject, Constants.DEVICE_MODEL_COMPONENT);

    let filePath: string;
    try {
      filePath = await this.doCreateModel(type, folder, name);
    } catch (error) {
      throw new ProcessError(ColorizedChannel.generateMessage(subject, error), Constants.DEVICE_MODEL_COMPONENT);
    }

    await UI.openAndShowTextDocument(filePath);
    const message: string = ColorizedChannel.generateMessage(subject);
    UI.showNotification(MessageType.Info, message);
    this.outputChannel.end(message, Constants.DEVICE_MODEL_COMPONENT);
  }

  private async doCreateModel(type: ModelType, folder: string, name: string): Promise<string> {
    const modelId: string = DeviceModelManager.generateModelId(name);
    const filePath: string = path.join(folder, DeviceModelManager.generateModelFilename(name, type));
    const templatePath: string = this.context.asAbsolutePath(
      path.join(Constants.RESOURCE_FOLDER, Constants.TEMPLATE_FOLDER, DeviceModelManager.getTemplateFilename(type)),
    );
    const replacement = new Map<string, string>();
    replacement.set(Constants.DIGITAL_TWIN_ID_PLACEHOLDER, modelId);

    await Utility.createFileFromTemplate(templatePath, filePath, replacement);
    return filePath;
  }
}
