// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as vscode from "vscode";
import { ColorizedChannel } from "./common/colorizedChannel";
import { Command } from "./common/command";
import { Constants } from "./common/constants";
import { NSAT } from "./common/nsat";
import { ProcessError } from "./common/processError";
import { TelemetryClient, TelemetryContext } from "./common/telemetryClient";
import { UserCancelledError } from "./common/userCancelledError";
import { DeviceModelManager, ModelType } from "./deviceModel/deviceModelManager";
import { SearchResult } from "./modelRepository/modelRepositoryInterface";
import { ModelRepositoryManager } from "./modelRepository/modelRepositoryManager";
import { MessageType, UI } from "./views/ui";

export function activate(context: vscode.ExtensionContext) {
  const outputChannel = new ColorizedChannel(Constants.CHANNEL_NAME);
  const telemetryClient = new TelemetryClient(context);
  const nsat = new NSAT(Constants.NSAT_SURVEY_URL, telemetryClient);
  const deviceModelManager = new DeviceModelManager(context, outputChannel);
  const modelRepositoryManager = new ModelRepositoryManager(context, outputChannel, Constants.WEB_VIEW_PATH);

  telemetryClient.sendEvent(Constants.EXTENSION_ACTIVATED_MSG);

  initCommand(
    context,
    telemetryClient,
    outputChannel,
    nsat,
    true,
    Command.CreateInterface,
    async (): Promise<void> => {
      return deviceModelManager.createModel(ModelType.Interface);
    },
  );

  initCommand(
    context,
    telemetryClient,
    outputChannel,
    nsat,
    true,
    Command.CreateCapabilityModel,
    async (): Promise<void> => {
      return deviceModelManager.createModel(ModelType.CapabilityModel);
    },
  );

  initCommand(
    context,
    telemetryClient,
    outputChannel,
    nsat,
    true,
    Command.OpenRepository,
    async (): Promise<void> => {
      return modelRepositoryManager.signIn();
    },
  );

  initCommand(
    context,
    telemetryClient,
    outputChannel,
    nsat,
    true,
    Command.SignOutRepository,
    async (): Promise<void> => {
      return modelRepositoryManager.signOut();
    },
  );

  initCommand(
    context,
    telemetryClient,
    outputChannel,
    nsat,
    true,
    Command.SubmitFiles,
    async (): Promise<void> => {
      return modelRepositoryManager.submitFiles();
    },
  );

  initCommand(
    context,
    telemetryClient,
    outputChannel,
    nsat,
    false,
    Command.DeleteModels,
    async (publicRepository: boolean, modelIds: string[]): Promise<void> => {
      return modelRepositoryManager.deleteModels(publicRepository, modelIds);
    },
  );

  initCommand(
    context,
    telemetryClient,
    outputChannel,
    nsat,
    false,
    Command.DownloadModels,
    async (publicRepository: boolean, modelIds: string[]): Promise<void> => {
      return modelRepositoryManager.downloadModels(publicRepository, modelIds);
    },
  );

  initCommand(
    context,
    telemetryClient,
    outputChannel,
    nsat,
    false,
    Command.SearchInterface,
    async (
      publicRepository: boolean,
      keyword?: string,
      pageSize?: number,
      continuationToken?: string,
    ): Promise<SearchResult> => {
      return modelRepositoryManager.searchModel(
        ModelType.Interface,
        publicRepository,
        keyword,
        pageSize,
        continuationToken,
      );
    },
  );

  initCommand(
    context,
    telemetryClient,
    outputChannel,
    nsat,
    false,
    Command.SearchCapabilityModel,
    async (
      publicRepository: boolean,
      keyword?: string,
      pageSize?: number,
      continuationToken?: string,
    ): Promise<SearchResult> => {
      return modelRepositoryManager.searchModel(
        ModelType.CapabilityModel,
        publicRepository,
        keyword,
        pageSize,
        continuationToken,
      );
    },
  );
}

export function deactivate() {}

function initCommand(
  context: vscode.ExtensionContext,
  telemetryClient: TelemetryClient,
  outputChannel: ColorizedChannel,
  nsat: NSAT,
  enableSurvey: boolean,
  command: Command,
  callback: (...args: any[]) => Promise<any>,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(command, async (...args: any[]) => {
      const telemetryContext: TelemetryContext = telemetryClient.createContext();
      telemetryClient.sendEvent(`${command}.start`);

      try {
        return await callback(...args);
      } catch (error) {
        if (error instanceof UserCancelledError) {
          outputChannel.warn(error.message);
        } else {
          telemetryClient.setErrorContext(telemetryContext, error);
          UI.showNotification(MessageType.Error, error.message);
          if (error instanceof ProcessError) {
            const message = `${error.message}\nStack: ${error.stack}`;
            outputChannel.error(message, error.component);
          } else {
            outputChannel.error(error.message);
          }
        }
      } finally {
        telemetryClient.closeContext(telemetryContext);
        telemetryClient.sendEvent(`${command}.end`, telemetryContext);
        outputChannel.show();
        if (enableSurvey) {
          nsat.takeSurvey(context);
        }
      }
    }),
  );
}
