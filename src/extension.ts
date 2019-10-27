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
import { DigitalTwinCompletionItemProvider } from "./intelliSense/digitalTwinCompletionItemProvider";
import { DigitalTwinDiagnosticProvider } from "./intelliSense/digitalTwinDiagnosticProvider";
import { DigitalTwinHoverProvider } from "./intelliSense/digitalTwinHoverProvider";
import { IntelliSenseUtility } from "./intelliSense/intelliSenseUtility";
import { SearchResult } from "./modelRepository/modelRepositoryInterface";
import { ModelRepositoryManager } from "./modelRepository/modelRepositoryManager";
import { MessageType, UI } from "./views/ui";
import { UIConstants } from "./views/uiConstants";

export function activate(context: vscode.ExtensionContext) {
  const outputChannel = new ColorizedChannel(Constants.CHANNEL_NAME);
  const telemetryClient = new TelemetryClient(context);
  const nsat = new NSAT(Constants.NSAT_SURVEY_URL, telemetryClient);
  const deviceModelManager = new DeviceModelManager(context, outputChannel);
  const modelRepositoryManager = new ModelRepositoryManager(context, outputChannel, Constants.WEB_VIEW_PATH);

  telemetryClient.sendEvent(Constants.EXTENSION_ACTIVATED_MSG);
  context.subscriptions.push(outputChannel);
  context.subscriptions.push(telemetryClient);

  // register events
  initIntelliSense(context);
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
            const message = `${error.message}\n${error.stack}`;
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

function initIntelliSense(context: vscode.ExtensionContext): void {
  if (!IntelliSenseUtility.initGraph(context)) {
    UI.showNotification(MessageType.Warn, UIConstants.INTELLISENSE_NOT_ENABLED_MSG);
    return;
  }
  // register providers of completionItem and hover
  const selector: vscode.DocumentSelector = {
    language: "json",
    scheme: "file",
  };
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      selector,
      new DigitalTwinCompletionItemProvider(),
      Constants.COMPLETION_TRIGGER,
    ),
  );
  context.subscriptions.push(vscode.languages.registerHoverProvider(selector, new DigitalTwinHoverProvider()));
  // register diagnostic
  let pendingDiagnostic: NodeJS.Timer;
  const diagnosticCollection: vscode.DiagnosticCollection = vscode.languages.createDiagnosticCollection(
    Constants.CHANNEL_NAME,
  );
  const diagnosticProvider = new DigitalTwinDiagnosticProvider();
  const activateTextEditor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
  if (activateTextEditor) {
    diagnosticProvider.updateDiagnostics(activateTextEditor.document, diagnosticCollection);
  }
  context.subscriptions.push(diagnosticCollection);
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((event) => {
      if (event) {
        diagnosticProvider.updateDiagnostics(event.document, diagnosticCollection);
      }
    }),
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event) {
        if (pendingDiagnostic) {
          clearTimeout(pendingDiagnostic);
        }
        pendingDiagnostic = setTimeout(
          () => diagnosticProvider.updateDiagnostics(event.document, diagnosticCollection),
          Constants.DEFAULT_TIMER_MS,
        );
      }
    }),
  );
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((document) => diagnosticCollection.delete(document.uri)),
  );
}
