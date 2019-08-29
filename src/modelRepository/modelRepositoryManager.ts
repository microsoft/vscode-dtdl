// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as vscode from "vscode";
import { VSCExpress } from "vscode-express";
import { BadRequestError } from "../common/badRequestError";
import { ColorizedChannel } from "../common/colorizedChannel";
import { Configuration } from "../common/configuration";
import { Constants } from "../common/constants";
import { CredentialStore } from "../common/credentialStore";
import { ProcessError } from "../common/processError";
import { Utility } from "../common/utility";
import { DeviceModelManager, ModelType } from "../deviceModel/deviceModelManager";
import { MessageType, UI } from "../views/ui";
import { UIConstants } from "../views/uiConstants";
import { ModelRepositoryClient } from "./modelRepositoryClient";
import { ModelRepositoryConnection } from "./modelRepositoryConnection";
import { GetResult, SearchResult } from "./modelRepositoryInterface";

export enum RepositoryType {
  Public = "Public repository",
  Company = "Company repository",
}

export interface RepositoryInfo {
  hostname: string;
  apiVersion: string;
  repositoryId?: string;
  accessToken?: string;
}

export interface ModelFileInfo {
  id: string;
  type: string;
  filePath: string;
}

export class ModelRepositoryManager {
  private static async buildRepositoryInfo(isCompany: boolean): Promise<RepositoryInfo> {
    if (isCompany) {
      const connectionString: string | null = await CredentialStore.get(Constants.MODEL_REPOSITORY_CONNECTION_KEY);
      if (!connectionString) {
        throw new Error(Constants.CONNECTION_STRING_NOT_FOUND_MSG);
      }
      const connection: ModelRepositoryConnection = ModelRepositoryConnection.parse(connectionString);
      return {
        hostname: Utility.enforceHttps(connection.hostName),
        apiVersion: Constants.MODEL_REPOSITORY_API_VERSION,
        repositoryId: connection.repositoryId,
        accessToken: connection.generateAccessToken(),
      };
    } else {
      const url: string | undefined = Configuration.getProperty<string>(Constants.PUBLIC_REPOSITORY_URL);
      if (!url) {
        throw new Error(Constants.PUBLIC_REPOSITORY_URL_NOT_FOUND_MSG);
      }
      return {
        hostname: Utility.enforceHttps(url),
        apiVersion: Constants.MODEL_REPOSITORY_API_VERSION,
      };
    }
  }

  private static async setupConnection(connectionString: string, isNew: boolean): Promise<void> {
    const connection: ModelRepositoryConnection = ModelRepositoryConnection.parse(connectionString);
    if (isNew) {
      ModelRepositoryConnection.validate(connection);
    }

    const repoInfo: RepositoryInfo = {
      hostname: Utility.enforceHttps(connection.hostName),
      apiVersion: Constants.MODEL_REPOSITORY_API_VERSION,
      repositoryId: connection.repositoryId,
      accessToken: connection.generateAccessToken(),
    };
    // test connection by searching interface
    ModelRepositoryClient.searchModel(repoInfo, ModelType.Interface, "", 1, null);
    if (isNew) {
      await CredentialStore.set(Constants.MODEL_REPOSITORY_CONNECTION_KEY, connectionString);
    }
  }

  private static validateModelIds(modelIds: string[]): void {
    if (!modelIds || modelIds.length === 0) {
      throw new BadRequestError(`modelIds ${Constants.NOT_EMPTY_MSG}`);
    }
  }

  private readonly express: VSCExpress;
  constructor(context: vscode.ExtensionContext, private readonly outputChannel: ColorizedChannel, filePath: string) {
    this.express = new VSCExpress(context, filePath);
  }

  public async signIn(): Promise<void> {
    const items: vscode.QuickPickItem[] = [{ label: RepositoryType.Public }, { label: RepositoryType.Company }];
    const selected: vscode.QuickPickItem = await UI.showQuickPick(UIConstants.SELECT_REPOSITORY_LABEL, items);

    const subject = `Connect to ${selected.label}`;
    this.outputChannel.start(subject, Constants.MODEL_REPOSITORY_COMPONENT);

    if (selected.label === RepositoryType.Company) {
      let isNew: boolean = false;
      let connectionString: string | null = await CredentialStore.get(Constants.MODEL_REPOSITORY_CONNECTION_KEY);
      if (!connectionString) {
        connectionString = await UI.inputConnectionString(UIConstants.INPUT_REPOSITORY_CONNECTION_STRING_LABEL);
        isNew = true;
      }

      try {
        ModelRepositoryManager.setupConnection(connectionString, isNew);
      } catch (error) {
        throw new ProcessError(ColorizedChannel.generateMessage(subject, error), Constants.MODEL_REPOSITORY_COMPONENT);
      }
    }

    const message: string = ColorizedChannel.generateMessage(subject);
    UI.showNotification(MessageType.Info, message);
    this.outputChannel.end(message, Constants.MODEL_REPOSITORY_COMPONENT);

    // open web view
    const uri =
      selected.label === RepositoryType.Company ? Constants.COMPANY_REPOSITORY_PAGE : Constants.PUBLIC_REPOSITORY_PAGE;
    this.express.open(uri, UIConstants.MODEL_REPOSITORY_TITLE, vscode.ViewColumn.Two, {
      retainContextWhenHidden: true,
      enableScripts: true,
    });
  }

  public async signOut(): Promise<void> {
    const subject = "Sign out company repository";
    this.outputChannel.start(subject, Constants.MODEL_REPOSITORY_COMPONENT);

    const success: boolean = await CredentialStore.delete(Constants.MODEL_REPOSITORY_CONNECTION_KEY);

    const message: string = ColorizedChannel.generateMessage(subject);
    if (success) {
      UI.showNotification(MessageType.Info, message);
    }
    this.outputChannel.end(message, Constants.MODEL_REPOSITORY_COMPONENT);

    if (this.express) {
      this.express.close(Constants.COMPANY_REPOSITORY_PAGE);
    }
  }

  public async submitFiles(): Promise<void> {
    const folder: string = await UI.selectRootFolder(UIConstants.SELECT_ROOT_FOLDER_LABEL);
    // const fileInfos: ModelFileInfo[] = await Utility.listModelFiles();
  }

  public async searchModel(
    modelType: string,
    isCompany: boolean,
    keyword: string = "",
    pageSize: number = 20,
    continuationToken: string | null = null,
  ): Promise<SearchResult> {
    const type: ModelType = DeviceModelManager.convertToModelType(modelType);
    if (!type) {
      throw new BadRequestError("unrecognized modelType");
    }
    if (pageSize <= 0) {
      throw new BadRequestError("pageSize should be greater than 0");
    }

    const subject = `Search ${type} by keyword "${keyword}" from ${
      isCompany ? RepositoryType.Company : RepositoryType.Public
    }`;
    this.outputChannel.start(subject, Constants.MODEL_REPOSITORY_COMPONENT);

    let result: SearchResult;
    try {
      const repoInfo: RepositoryInfo = await ModelRepositoryManager.buildRepositoryInfo(isCompany);
      result = await ModelRepositoryClient.searchModel(repoInfo, type, keyword, pageSize, continuationToken);
    } catch (error) {
      throw new ProcessError(ColorizedChannel.generateMessage(subject, error), Constants.MODEL_REPOSITORY_COMPONENT);
    }

    const message = ColorizedChannel.generateMessage(subject);
    this.outputChannel.end(message, Constants.DEVICE_MODEL_COMPONENT);
    return result;
  }

  public async deleteModels(isCompany: boolean, modelIds: string[]): Promise<void> {
    if (!isCompany) {
      throw new BadRequestError(`${RepositoryType.Public} not support delete operation`);
    }
    ModelRepositoryManager.validateModelIds(modelIds);

    try {
      const repoInfo: RepositoryInfo = await ModelRepositoryManager.buildRepositoryInfo(isCompany);
      await this.doDeleteLoopSilently(repoInfo, modelIds);
    } catch (error) {
      const subject = `Delete models from ${RepositoryType.Company}`;
      throw new ProcessError(ColorizedChannel.generateMessage(subject, error), Constants.MODEL_REPOSITORY_COMPONENT);
    }
  }

  public async downloadModels(isCompany: boolean, modelIds: string[]): Promise<void> {
    ModelRepositoryManager.validateModelIds(modelIds);

    const folder: string = await UI.selectRootFolder(UIConstants.SELECT_ROOT_FOLDER_LABEL);

    try {
      const repoInfo: RepositoryInfo = await ModelRepositoryManager.buildRepositoryInfo(isCompany);
      await this.doDownloadLoopSilently([repoInfo], modelIds, folder);
    } catch (error) {
      const subject = `Download models from ${isCompany ? RepositoryType.Company : RepositoryType.Public}`;
      throw new ProcessError(ColorizedChannel.generateMessage(subject, error), Constants.MODEL_REPOSITORY_COMPONENT);
    }
  }

  public async downloadDependentInterface(folder: string, filePath: string): Promise<void> {
    // for code gen integration, used as api
    // get existing interface files
    // find dependent interface file list from dcm file
    // diff the files to download
    // download interface files
  }

  private async doDownloadLoopSilently(repoInfos: RepositoryInfo[], modelIds: string[], folder: string) {
    for (const modelId of modelIds) {
      const subject = `Download model by id ${modelId}`;
      this.outputChannel.start(subject, Constants.MODEL_REPOSITORY_COMPONENT);

      try {
        await this.doDownloadModel(repoInfos, modelId, folder);
        this.outputChannel.end(ColorizedChannel.generateMessage(subject), Constants.MODEL_REPOSITORY_COMPONENT);
      } catch (error) {
        this.outputChannel.error(
          ColorizedChannel.generateMessage(subject, error),
          Constants.MODEL_REPOSITORY_COMPONENT,
        );
      }
    }
  }

  private async doDownloadModel(repoInfos: RepositoryInfo[], modelId: string, folder: string): Promise<void> {
    let result: GetResult | undefined;
    for (const repoInfo of repoInfos) {
      try {
        result = await ModelRepositoryClient.getModel(repoInfo, modelId, true);
        break;
      } catch (error) {
        if (error.statusCode === Constants.NOT_FOUND_CODE) {
          this.outputChannel.warn(`Model ${modelId} is not found from ${repoInfo.hostname}`);
        } else {
          this.outputChannel.error(`Fail to get model ${modelId} from ${repoInfo.hostname}`);
        }
      }
    }

    if (result) {
      await Utility.createModelFile(folder, result.modelId, result.content);
    }
  }

  private async doDeleteLoopSilently(repoInfo: RepositoryInfo, modelIds: string[]): Promise<void> {
    for (const modelId of modelIds) {
      const subject = `Delete model by id ${modelId}`;
      this.outputChannel.start(subject, Constants.MODEL_REPOSITORY_COMPONENT);

      try {
        await ModelRepositoryClient.deleteModel(repoInfo, modelId);
        this.outputChannel.end(ColorizedChannel.generateMessage(subject), Constants.MODEL_REPOSITORY_COMPONENT);
      } catch (error) {
        this.outputChannel.error(
          ColorizedChannel.generateMessage(subject, error),
          Constants.MODEL_REPOSITORY_COMPONENT,
        );
      }
    }
  }
}
