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
import { UserCancelledError } from "../common/userCancelledError";
import { Utility } from "../common/utility";
import { ModelType } from "../deviceModel/deviceModelManager";
import { DigitalTwinConstants } from "../intelliSense/digitalTwinConstants";
import { ChoiceType, MessageType, UI } from "../views/ui";
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
  type: ModelType;
  filePath: string;
}

interface SubmitOptions {
  overwrite: boolean;
}

export class ModelRepositoryManager {
  private static async createRepositoryInfo(publicRepository: boolean): Promise<RepositoryInfo> {
    if (publicRepository) {
      const url: string | undefined = Configuration.getProperty<string>(Constants.PUBLIC_REPOSITORY_URL);
      if (!url) {
        throw new Error(Constants.PUBLIC_REPOSITORY_URL_NOT_FOUND_MSG);
      }
      return {
        hostname: Utility.enforceHttps(url),
        apiVersion: Constants.MODEL_REPOSITORY_API_VERSION,
      };
    } else {
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
    }
  }

  private static async setupConnection(): Promise<void> {
    let newConnection: boolean = false;
    let connectionString: string | null = await CredentialStore.get(Constants.MODEL_REPOSITORY_CONNECTION_KEY);
    if (!connectionString) {
      connectionString = await UI.inputConnectionString(UIConstants.INPUT_REPOSITORY_CONNECTION_STRING_LABEL);
      newConnection = true;
    }

    const connection: ModelRepositoryConnection = ModelRepositoryConnection.parse(connectionString);
    const repoInfo: RepositoryInfo = {
      hostname: Utility.enforceHttps(connection.hostName),
      apiVersion: Constants.MODEL_REPOSITORY_API_VERSION,
      repositoryId: connection.repositoryId,
      accessToken: connection.generateAccessToken(),
    };
    // test connection by calling searchModel
    await ModelRepositoryClient.searchModel(repoInfo, ModelType.Interface, Constants.EMPTY_STRING, 1, null);
    if (newConnection) {
      await CredentialStore.set(Constants.MODEL_REPOSITORY_CONNECTION_KEY, connectionString);
    }
  }

  private static validateModelIds(modelIds: string[]): void {
    if (!modelIds || modelIds.length === 0) {
      throw new BadRequestError(`modelIds ${Constants.NOT_EMPTY_MSG}`);
    }
  }

  private readonly express: VSCExpress;
  private readonly component: string;
  constructor(context: vscode.ExtensionContext, private readonly outputChannel: ColorizedChannel, filePath: string) {
    this.express = new VSCExpress(context, filePath);
    this.component = Constants.MODEL_REPOSITORY_COMPONENT;
  }

  public async signIn(): Promise<void> {
    const items: vscode.QuickPickItem[] = [{ label: RepositoryType.Public }, { label: RepositoryType.Company }];
    const selected: vscode.QuickPickItem = await UI.showQuickPick(UIConstants.SELECT_REPOSITORY_LABEL, items);

    const operation = `Connect to ${selected.label}`;
    this.outputChannel.start(operation, this.component);

    if (selected.label === RepositoryType.Company) {
      try {
        await ModelRepositoryManager.setupConnection();
      } catch (error) {
        if (error instanceof UserCancelledError) {
          throw error;
        } else {
          throw new ProcessError(operation, error, this.component);
        }
      }
    }

    // open web view
    const uri: string =
      selected.label === RepositoryType.Company ? Constants.COMPANY_REPOSITORY_PAGE : Constants.PUBLIC_REPOSITORY_PAGE;
    this.express.open(uri, UIConstants.MODEL_REPOSITORY_TITLE, vscode.ViewColumn.Two, {
      retainContextWhenHidden: true,
      enableScripts: true,
    });
    UI.showNotification(MessageType.Info, ColorizedChannel.formatMessage(operation));
    this.outputChannel.end(operation, this.component);
  }

  public async signOut(): Promise<void> {
    const operation = "Sign out company repository";
    this.outputChannel.start(operation, this.component);

    await CredentialStore.delete(Constants.MODEL_REPOSITORY_CONNECTION_KEY);

    // close web view
    if (this.express) {
      this.express.close(Constants.COMPANY_REPOSITORY_PAGE);
    }
    UI.showNotification(MessageType.Info, ColorizedChannel.formatMessage(operation));
    this.outputChannel.end(operation, this.component);
  }

  public async submitFiles(): Promise<void> {
    const files: string[] | undefined = await UI.selectModelFiles(UIConstants.SELECT_MODELS_LABEL);
    if (!files || files.length === 0) {
      return;
    }

    await UI.ensureFilesSaved(UIConstants.SAVE_FILE_CHANGE_LABEL, files);
    try {
      await ModelRepositoryManager.setupConnection();
    } catch (error) {
      if (error instanceof UserCancelledError) {
        throw error;
      } else {
        throw new ProcessError(`Connect to ${RepositoryType.Company}`, error, this.component);
      }
    }

    try {
      const repoInfo: RepositoryInfo = await ModelRepositoryManager.createRepositoryInfo(false);
      await this.doSubmitLoopSilently(repoInfo, files);
    } catch (error) {
      const operation = `Submit models to ${RepositoryType.Company}`;
      throw new ProcessError(operation, error, this.component);
    }
  }

  public async searchModel(
    type: ModelType,
    publicRepository: boolean,
    keyword: string = Constants.EMPTY_STRING,
    pageSize: number = Constants.DEFAULT_PAGE_SIZE,
    continuationToken: string | null = null,
  ): Promise<SearchResult> {
    if (pageSize <= 0) {
      throw new BadRequestError("pageSize should be greater than 0");
    }

    const operation = `Search ${type} by keyword "${keyword}" from ${
      publicRepository ? RepositoryType.Public : RepositoryType.Company
    }`;
    this.outputChannel.start(operation, this.component);

    let result: SearchResult;
    try {
      const repoInfo: RepositoryInfo = await ModelRepositoryManager.createRepositoryInfo(publicRepository);
      result = await ModelRepositoryClient.searchModel(repoInfo, type, keyword, pageSize, continuationToken);
    } catch (error) {
      throw new ProcessError(operation, error, this.component);
    }

    this.outputChannel.end(operation, this.component);
    return result;
  }

  public async deleteModels(publicRepository: boolean, modelIds: string[]): Promise<void> {
    if (publicRepository) {
      throw new BadRequestError(`${RepositoryType.Public} not support delete operation`);
    }
    ModelRepositoryManager.validateModelIds(modelIds);

    try {
      const repoInfo: RepositoryInfo = await ModelRepositoryManager.createRepositoryInfo(publicRepository);
      await this.doDeleteLoopSilently(repoInfo, modelIds);
    } catch (error) {
      const operation = `Delete models from ${RepositoryType.Company}`;
      throw new ProcessError(operation, error, this.component);
    }
  }

  public async downloadModels(publicRepository: boolean, modelIds: string[]): Promise<void> {
    ModelRepositoryManager.validateModelIds(modelIds);

    const folder: string = await UI.selectRootFolder(UIConstants.SELECT_ROOT_FOLDER_LABEL);

    try {
      const repoInfo: RepositoryInfo = await ModelRepositoryManager.createRepositoryInfo(publicRepository);
      await this.doDownloadLoopSilently([repoInfo], modelIds, folder);
    } catch (error) {
      const operation = `Download models from ${publicRepository ? RepositoryType.Public : RepositoryType.Company}`;
      throw new ProcessError(operation, error, this.component);
    }
  }

  public async downloadDependentInterface(folder: string, filePath: string): Promise<void> {
    // TODO:(erichen): for code gen integration, used as api
    // get existing interface files
    // find dependent interface file list from dcm file
    // diff the files to download
    // download interface files
  }

  private async doDownloadLoopSilently(repoInfos: RepositoryInfo[], modelIds: string[], folder: string): Promise<void> {
    for (const modelId of modelIds) {
      const operation = `Download model by id ${modelId}`;
      this.outputChannel.start(operation, this.component);

      try {
        await this.doDownloadModel(repoInfos, modelId, folder);
        this.outputChannel.end(operation, this.component);
      } catch (error) {
        this.outputChannel.error(operation, this.component, error);
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
          this.outputChannel.error(
            `Fail to get model ${modelId} from ${repoInfo.hostname}, statusCode: ${error.statusCode}`,
          );
        }
      }
    }
    if (result) {
      await Utility.createModelFile(folder, result.modelId, result.content);
    }
  }

  private async doDeleteLoopSilently(repoInfo: RepositoryInfo, modelIds: string[]): Promise<void> {
    for (const modelId of modelIds) {
      const operation = `Delete model by id ${modelId}`;
      this.outputChannel.start(operation, this.component);

      try {
        await ModelRepositoryClient.deleteModel(repoInfo, modelId);
        this.outputChannel.end(operation, this.component);
      } catch (error) {
        this.outputChannel.error(operation, this.component, error);
      }
    }
  }

  private async doSubmitLoopSilently(repoInfo: RepositoryInfo, files: string[]): Promise<void> {
    const option: SubmitOptions = { overwrite: false };
    for (const file of files) {
      const operation = `Submit file ${file}`;
      this.outputChannel.start(operation, this.component);

      try {
        await this.doSubmitModel(repoInfo, file, option);
        this.outputChannel.end(operation, this.component);
      } catch (error) {
        this.outputChannel.error(operation, this.component, error);
      }
    }
  }

  private async doSubmitModel(repoInfo: RepositoryInfo, file: string, option: SubmitOptions): Promise<void> {
    const content = await Utility.getJsonContent(file);
    const modelId: string = content[DigitalTwinConstants.ID];

    let result: GetResult | undefined;
    try {
      result = await ModelRepositoryClient.getModel(repoInfo, modelId, true);
    } catch (error) {
      // return 404 means it is a new model
      if (error.statusCode !== Constants.NOT_FOUND_CODE) {
        throw error;
      }
    }

    if (result) {
      if (!option.overwrite) {
        const message = `Model ${modelId} already exist, ${UIConstants.ASK_TO_OVERWRITE_MSG}`;
        const choice: string | undefined = await vscode.window.showWarningMessage(
          message,
          ChoiceType.All,
          ChoiceType.Yes,
          ChoiceType.No,
        );
        if (!choice || choice === ChoiceType.No) {
          this.outputChannel.warn(`Skip overwrite model ${modelId}`);
          return;
        } else if (choice === ChoiceType.All) {
          option.overwrite = true;
        }
      }
    }
    await ModelRepositoryClient.updateModel(repoInfo, modelId, content);
  }
}
