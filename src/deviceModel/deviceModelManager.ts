// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as path from "path";
import * as vscode from "vscode";
import { ColorizedChannel } from "../common/colorizedChannel";
import { Constants } from "../common/constants";
import { ProcessError } from "../common/processError";
import { Utility } from "../common/utility";
import { MessageType, UI } from "../view/ui";
import { UIConstants } from "../view/uiConstants";

/**
 * DigitalTwin model type
 */
export enum ModelType {
  Interface = "Interface"
}

/**
 * DigitalTwin device model manager
 */
export class DeviceModelManager {
  /**
   * generate DigitalTwin model id
   * @param name model name
   */
  public static generateModelId(name: string): string {
    return `dtmi:com:example:${name};1`;
  }

  /**
   * generate DigitalTwin model file name
   * @param name model name
   * @param type model type
   */
  public static generateModelFileName(name: string): string {
    return `${name}.json`;
  }

  private readonly component: string;
  constructor(private readonly context: vscode.ExtensionContext, private readonly outputChannel: ColorizedChannel) {
    this.component = Constants.DEVICE_MODEL_COMPONENT;
  }

  /**
   * create DigitalTwin model with UI interaction
   * @param type model type
   */
  public async createModel(type: ModelType): Promise<void> {
    const folder: string = await UI.selectRootFolder(UIConstants.SELECT_ROOT_FOLDER_LABEL);
    const name: string = await UI.inputModelName(UIConstants.INPUT_MODEL_NAME_LABEL, type, folder);
    const templateFolder: string = this.context.asAbsolutePath(path.join(Constants.TEMPLATE_FOLDER));
    const template: string = await UI.selectTemplateFile(UIConstants.SELECT_TEMPLATE_FILE_LABEL, templateFolder);
    const operation = `Create ${type} "${name}" in folder ${folder} by template "${template}"`;
    this.outputChannel.start(operation, this.component);

    let filePath: string;
    try {
      filePath = await this.doCreateModel(folder, name, path.join(templateFolder, template));
    } catch (error) {
      throw new ProcessError(operation, error, this.component);
    }

    await UI.openAndShowTextDocument(filePath);
    UI.showNotification(MessageType.Info, ColorizedChannel.formatMessage(operation));
    this.outputChannel.end(operation, this.component);
  }

  /**
   * create DigitalTwin model
   * @param folder root folder
   * @param name model name
   * @param templatePath template file path
   */
  private async doCreateModel(folder: string, name: string, templatePath: string): Promise<string> {
    const modelId: string = DeviceModelManager.generateModelId(name);
    const filePath: string = path.join(folder, DeviceModelManager.generateModelFileName(name));
    const replacement = new Map<string, string>();
    replacement.set(Constants.MODEL_ID_PLACEHOLDER, modelId);
    replacement.set(Constants.MODEL_NAME_PLACEHOLDER, name);
    await Utility.createFileFromTemplate(templatePath, filePath, replacement);
    return filePath;
  }
}
