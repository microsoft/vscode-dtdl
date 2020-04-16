// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as vscode from "vscode";
import { ColorizedChannel } from "./common/colorizedChannel";
import { Command } from "./common/command";
import { Constants } from "./common/constants";
import { NSAT } from "./common/nsat";
import { ProcessError } from "./common/processError";
import { TelemetryClient } from "./common/telemetryClient";
import { TelemetryContext } from "./common/telemetryContext";
import { UserCancelledError } from "./common/userCancelledError";
import { DeviceModelManager, ModelType } from "./deviceModel/deviceModelManager";
import { DigitalTwinCompletionItemProvider } from "./intelliSense/digitalTwinCompletionItemProvider";
import { DigitalTwinDiagnosticProvider } from "./intelliSense/digitalTwinDiagnosticProvider";
import { IntelliSenseUtility } from "./intelliSense/intelliSenseUtility";
import { MessageType, UI } from "./view/ui";

export function activate(context: vscode.ExtensionContext) {
  const outputChannel = new ColorizedChannel(Constants.CHANNEL_NAME);
  const telemetryClient = new TelemetryClient(context);
  const nsat = new NSAT(Constants.NSAT_SURVEY_URL, telemetryClient);
  const deviceModelManager = new DeviceModelManager(context, outputChannel);

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
      const telemetryContext: TelemetryContext = TelemetryContext.startNew();
      try {
        return await callback(...args);
      } catch (error) {
        telemetryContext.setError(error);
        if (error instanceof UserCancelledError) {
          outputChannel.warn(error.message);
        } else {
          UI.showNotification(MessageType.Error, error.message);
          if (error instanceof ProcessError) {
            const message = `${error.message}\n${error.stack}`;
            outputChannel.error(message, error.component);
          } else {
            outputChannel.error(error.message);
          }
        }
      } finally {
        telemetryContext.end();
        telemetryClient.sendEvent(command, telemetryContext);
        outputChannel.show();
        if (enableSurvey) {
          nsat.takeSurvey(context);
        }
      }
    }),
  );
}

function initIntelliSense(context: vscode.ExtensionContext): void {
  // init DigitalTwin graph
  IntelliSenseUtility.initGraph(context);
  // register provider
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
  // register diagnostic
  const diagnosticCollection: vscode.DiagnosticCollection = vscode.languages.createDiagnosticCollection(
    Constants.CHANNEL_NAME,
  );
  context.subscriptions.push(diagnosticCollection);
  let pendingDiagnostic: NodeJS.Timer;
  const diagnosticProvider = new DigitalTwinDiagnosticProvider();
  const activeTextEditor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
  if (activeTextEditor && IntelliSenseUtility.isDigitalTwinFile(activeTextEditor.document)) {
    // delay for DigitalTwin graph initialization
    pendingDiagnostic = setTimeout(
      () => diagnosticProvider.updateDiagnostics(activeTextEditor.document, diagnosticCollection),
      Constants.DEFAULT_TIMER_MS,
    );
  }
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((e: vscode.TextEditor | undefined) => {
      // only update diagnostics if the document is new
      if (e && IntelliSenseUtility.isDigitalTwinFile(e.document) && !diagnosticCollection.has(e.document.uri)) {
        diagnosticProvider.updateDiagnostics(e.document, diagnosticCollection);
      }
    }),
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => {
      if (e && IntelliSenseUtility.isDigitalTwinFile(e.document)) {
        if (pendingDiagnostic) {
          clearTimeout(pendingDiagnostic);
        }
        pendingDiagnostic = setTimeout(
          () => diagnosticProvider.updateDiagnostics(e.document, diagnosticCollection),
          Constants.DEFAULT_TIMER_MS,
        );
      }
    }),
  );
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((e: vscode.TextDocument) => {
      if (IntelliSenseUtility.isDigitalTwinFile(e)) {
        diagnosticCollection.delete(e.uri);
      }
    }),
  );
  // TODO(erichen): add telemetry for opened file
}
