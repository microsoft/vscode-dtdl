// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as vscode from "vscode";
import { VSCExpress } from "vscode-express";
import { BadRequestError } from "../common/badRequestError";
import { ColorizedChannel } from "../common/colorizedChannel";
import { Command } from "../common/command";
import { Configuration } from "../common/configuration";
import { Constants } from "../common/constants";
import { CredentialStore } from "../common/credentialStore";
import { ProcessError } from "../common/processError";
import { TelemetryClient } from "../common/telemetryClient";
import { TelemetryContext } from "../common/telemetryContext";
import { UserCancelledError } from "../common/userCancelledError";
import { Utility } from "../common/utility";
import { DeviceModelManager, ModelType } from "../deviceModel/deviceModelManager";
import { DigitalTwinConstants } from "../intelliSense/digitalTwinConstants";
import { ChoiceType, MessageType, UI } from "../view/ui";
import { UIConstants } from "../view/uiConstants";
import { ModelRepositoryClient } from "./modelRepositoryClient";
import { ModelRepositoryConnection } from "./modelRepositoryConnection";
import { GetResult, SearchResult } from "./modelRepositoryInterface";

/**
 * Repository type
 */
export enum RepositoryType {
  Public = "Public repository",
  Company = "Company repository",
}

/**
 * Repository info
 */
export interface RepositoryInfo {
  hostname: string;
  apiVersion: string;
  repositoryId?: string;
  accessToken?: string;
}

/**
 * Model file info
 */
export interface ModelFileInfo {
  id: string;
  type: ModelType;
  filePath: string;
}

/**
 * Submit options
 */
interface SubmitOptions {
  overwrite: boolean;
}

/**
 * Model repository manager
 */
export class ModelRepositoryManager {
  /**
   * create repository info
   * @param publicRepository identify if it is public repository
   */
  private static async createRepositoryInfo(publicRepository: boolean): Promise<RepositoryInfo> {
    if (publicRepository) {
      // get public repository connection from configuration
      const url: string | undefined = Configuration.getProperty<string>(Constants.PUBLIC_REPOSITORY_URL);
      if (!url) {
        throw new Error(Constants.PUBLIC_REPOSITORY_URL_NOT_FOUND_MSG);
      }
      return {
        hostname: Utility.enforceHttps(url),
        apiVersion: Constants.MODEL_REPOSITORY_API_VERSION,
      };
    } else {
      // get company repository connection from credential store
      const connectionString: string | null = await CredentialStore.get(Constants.MODEL_REPOSITORY_CONNECTION_KEY);
      if (!connectionString) {
        throw new Error(Constants.CONNECTION_STRING_NOT_FOUND_MSG);
      }
      return ModelRepositoryManager.getCompanyRepositoryInfo(connectionString);
    }
  }

  /**
   * get available repository info, company repository is prior to public repository
   */
  private static async getAvailableRepositoryInfo(): Promise<RepositoryInfo[]> {
    const repoInfos: RepositoryInfo[] = [];
    const connectionString: string | null = await CredentialStore.get(Constants.MODEL_REPOSITORY_CONNECTION_KEY);
    if (connectionString) {
      repoInfos.push(ModelRepositoryManager.getCompanyRepositoryInfo(connectionString));
    }
    repoInfos.push(await ModelRepositoryManager.createRepositoryInfo(true));
    return repoInfos;
  }

  /**
   * set up company model repository connection
   */
  private static async setupConnection(): Promise<void> {
    let newConnection: boolean = false;
    let connectionString: string | null = await CredentialStore.get(Constants.MODEL_REPOSITORY_CONNECTION_KEY);
    if (!connectionString) {
      connectionString = await UI.inputConnectionString(UIConstants.INPUT_REPOSITORY_CONNECTION_STRING_LABEL);
      newConnection = true;
    }
    const repoInfo: RepositoryInfo = ModelRepositoryManager.getCompanyRepositoryInfo(connectionString);
    // test connection by calling searchModel
    await ModelRepositoryClient.searchModel(repoInfo, ModelType.Interface, Constants.EMPTY_STRING, 1, null);
    if (newConnection) {
      await CredentialStore.set(Constants.MODEL_REPOSITORY_CONNECTION_KEY, connectionString);
    }
  }

  /**
   * get company repository info
   * @param connectionString connection string
   */
  private static getCompanyRepositoryInfo(connectionString: string): RepositoryInfo {
    const connection: ModelRepositoryConnection = ModelRepositoryConnection.parse(connectionString);
    return {
      hostname: Utility.enforceHttps(connection.hostName),
      apiVersion: Constants.MODEL_REPOSITORY_API_VERSION,
      repositoryId: connection.repositoryId,
      accessToken: connection.generateAccessToken(),
    };
  }

  /**
   * validate model id list
   * @param modelIds model id list
   */
  private static validateModelIds(modelIds: string[]): void {
    if (!modelIds || modelIds.length === 0) {
      throw new BadRequestError(`modelIds ${Constants.NOT_EMPTY_MSG}`);
    }
  }

  private readonly express: VSCExpress;
  private readonly component: string;
  constructor(
    context: vscode.ExtensionContext,
    filePath: string,
    private readonly outputChannel: ColorizedChannel,
    private readonly telemetryClient: TelemetryClient,
  ) {
    this.express = new VSCExpress(context, filePath);
    this.component = Constants.MODEL_REPOSITORY_COMPONENT;
  }

  /**
   * sign in model repository
   */
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

  /**
   * sign out model repository
   */
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

  /**
   * submit files to model repository
   */
  public async submitFiles(): Promise<void> {
    const files: string[] = await UI.selectModelFiles(UIConstants.SELECT_MODELS_LABEL);
    if (files.length === 0) {
      return;
    }
    // check unsaved files and save
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

    const usageData = new Map<ModelType, string[]>();
    try {
      const repoInfo: RepositoryInfo = await ModelRepositoryManager.createRepositoryInfo(false);
      await this.doSubmitLoopSilently(repoInfo, files, usageData);
    } catch (error) {
      const operation = `Submit models to ${RepositoryType.Company}`;
      throw new ProcessError(operation, error, this.component);
    }
    // send usage data
    this.sendUsageDataOfSubmit(usageData);
  }

  /**
   * search model from repository
   * @param type model type
   * @param publicRepository identify if it is public repository
   * @param keyword keyword
   * @param pageSize page size
   * @param continuationToken continuation token
   */
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

    // only show output when keyword is defined
    const showOutput: boolean = keyword ? true : false;
    const operation = `Search ${type} by keyword "${keyword}" from ${
      publicRepository ? RepositoryType.Public : RepositoryType.Company
    }`;
    if (showOutput) {
      this.outputChannel.start(operation, this.component);
    }

    let result: SearchResult;
    try {
      const repoInfo: RepositoryInfo = await ModelRepositoryManager.createRepositoryInfo(publicRepository);
      result = await ModelRepositoryClient.searchModel(repoInfo, type, keyword, pageSize, continuationToken);
    } catch (error) {
      throw new ProcessError(operation, error, this.component);
    }

    if (showOutput) {
      this.outputChannel.end(operation, this.component);
    }
    return result;
  }

  /**
   * delete models from repository
   * @param publicRepository identify if it is public repository
   * @param modelIds model id list
   */
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

  /**
   * download models from repository
   * @param publicRepository identify if it is public repository
   * @param modelIds model id list
   */
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

  /**
   * download dependent interface of capability model, throw exception when interface not found
   * @param folder folder to download interface
   * @param capabilityModelFile capability model file path
   */
  public async downloadDependentInterface(folder: string, capabilityModelFile: string): Promise<void> {
    if (!folder || !capabilityModelFile) {
      throw new BadRequestError(`folder and capabilityModelFile ${Constants.NOT_EMPTY_MSG}`);
    }
    // get implemented interface of capability model
    const content = await Utility.getJsonContent(capabilityModelFile);
    const implementedInterface = content[DigitalTwinConstants.IMPLEMENTS];
    if (!implementedInterface || implementedInterface.length === 0) {
      throw new BadRequestError("no implemented interface found in capability model");
    }

    // get existing interface file in workspace
    const repoInfos: RepositoryInfo[] = await ModelRepositoryManager.getAvailableRepositoryInfo();
    const fileInfos: ModelFileInfo[] = await UI.findModelFiles(ModelType.Interface);
    const exist = new Set<string>(fileInfos.map((f) => f.id));
    let schema: any;
    let found: boolean;
    let message: string;
    for (const item of implementedInterface) {
      schema = item[DigitalTwinConstants.SCHEMA];
      if (typeof schema !== "string" || exist.has(schema)) {
        continue;
      }
      found = await this.doDownloadModel(repoInfos, schema, folder);
      if (!found) {
        message = `interface ${schema} not found`;
        if (repoInfos.length === 1) {
          message = `${message}. ${Constants.NEED_OPEN_COMPANY_REPOSITORY_MSG}`;
        }
        throw new BadRequestError(message);
      }
    }
  }

  /**
   * download models silently, fault tolerant and don't throw exception
   * @param repoInfos repository info list
   * @param modelIds model id list
   * @param folder folder to download models
   */
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

  /**
   * download model from repository, return false if model not found
   * @param repoInfos repository info list
   * @param modelId model id
   * @param folder folder to download model
   */
  private async doDownloadModel(repoInfos: RepositoryInfo[], modelId: string, folder: string): Promise<boolean> {
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
      return true;
    }
    return false;
  }

  /**
   * delete models silently, fault tolerant and don't throw exception
   * @param repoInfo repository info
   * @param modelIds model id list
   */
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

  /**
   * submit model files silently, fault tolerant and don't throw exception
   * @param repoInfo repository info
   * @param files model file list
   * @param usageData usage data
   */
  private async doSubmitLoopSilently(
    repoInfo: RepositoryInfo,
    files: string[],
    usageData: Map<ModelType, string[]>,
  ): Promise<void> {
    const options: SubmitOptions = { overwrite: false };
    for (const file of files) {
      const operation = `Submit file ${file}`;
      this.outputChannel.start(operation, this.component);

      try {
        await this.doSubmitModel(repoInfo, file, options, usageData);
        this.outputChannel.end(operation, this.component);
      } catch (error) {
        this.outputChannel.error(operation, this.component, error);
      }
    }
  }

  /**
   * submit model file to repository
   * @param repoInfo repository info
   * @param filePath model file path
   * @param options submit options
   * @param usageData usage data
   */
  private async doSubmitModel(
    repoInfo: RepositoryInfo,
    filePath: string,
    option: SubmitOptions,
    usageData: Map<ModelType, string[]>,
  ): Promise<void> {
    const content = await Utility.getJsonContent(filePath);
    const modelId: string = content[DigitalTwinConstants.ID];
    const modelType: ModelType = DeviceModelManager.convertToModelType(content[DigitalTwinConstants.TYPE]);
    let result: GetResult | undefined;
    try {
      result = await ModelRepositoryClient.getModel(repoInfo, modelId, true);
    } catch (error) {
      // return 404 means it is a new model
      if (error.statusCode !== Constants.NOT_FOUND_CODE) {
        throw error;
      }
    }
    // ask user to overwrite
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

    // record submitted model id
    let modelIds: string[] | undefined = usageData.get(modelType);
    if (!modelIds) {
      modelIds = [];
      usageData.set(modelType, modelIds);
    }
    modelIds.push(modelId);
  }

  /**
   * send usage data of SubmitFiles
   * @param usageData usage data
   */
  private sendUsageDataOfSubmit(usageData: Map<ModelType, string[]>): void {
    const telemetryContext: TelemetryContext = TelemetryContext.startNew();
    let propertyName: string = Constants.EMPTY_STRING;
    let propertyValue: string;
    for (const [key, value] of usageData) {
      switch (key) {
        case ModelType.Interface:
          propertyName = "interfaceId";
          break;
        case ModelType.CapabilityModel:
          propertyName = "capabilityModelId";
          break;
        default:
      }
      if (propertyName) {
        propertyValue = value.map((id) => Utility.hash(id)).join(Constants.DEFAULT_SEPARATOR);
        telemetryContext.setProperty(propertyName, propertyValue);
      }
    }
    this.telemetryClient.sendEvent(`${Command.SubmitFiles}.data`, telemetryContext);
  }
}
