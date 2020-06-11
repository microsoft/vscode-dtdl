// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as vscode from "vscode";
import { ColorizedChannel } from "./common/colorizedChannel";
import { Constants } from "./common/constants";
import { EventType } from "./common/eventType";
import { NSAT } from "./common/nsat";
import { ProcessError } from "./common/processError";
import { TelemetryClient } from "./common/telemetryClient";
import { TelemetryContext } from "./common/telemetryContext";
import { UserCancelledError } from "./common/userCancelledError";
import { DeviceModelManager, ModelType } from "./deviceModel/deviceModelManager";
import { DigitalTwinCompletionItemProvider } from "./intelliSense/digitalTwinCompletionItemProvider";
import { DigitalTwinDiagnosticProvider } from "./intelliSense/digitalTwinDiagnosticProvider";
import { IntelliSenseUtility, ModelContent } from "./intelliSense/intelliSenseUtility";
import { MessageType, UI } from "./view/ui";

function initIntelliSense(context: vscode.ExtensionContext, telemetryClient: TelemetryClient): void {
  // init DigitalTwin graph
  IntelliSenseUtility.initGraph(context);
  // register provider
  const selector: vscode.DocumentSelector = {
    language: "json",
    scheme: "file"
  };
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      selector,
      new DigitalTwinCompletionItemProvider(),
      Constants.COMPLETION_TRIGGER
    )
  );
  // register diagnostic
  const diagnosticCollection: vscode.DiagnosticCollection = vscode.languages.createDiagnosticCollection(
    Constants.CHANNEL_NAME
  );
  context.subscriptions.push(diagnosticCollection);
  let pendingDiagnostic: NodeJS.Timer;
  const diagnosticProvider = new DigitalTwinDiagnosticProvider();
  const activeTextEditor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
  if (activeTextEditor && IntelliSenseUtility.isDigitalTwinFile(activeTextEditor.document)) {
    // delay for DigitalTwin graph initialization
    pendingDiagnostic = setTimeout(
      () => diagnosticProvider.updateDiagnostics(activeTextEditor.document, diagnosticCollection),
      Constants.DEFAULT_TIMER_MS
    );
  }
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor: vscode.TextEditor | undefined) => {
      // only update diagnostics if it is a new document
      if (
        editor &&
        IntelliSenseUtility.isDigitalTwinFile(editor.document) &&
        !diagnosticCollection.has(editor.document.uri)
      ) {
        diagnosticProvider.updateDiagnostics(editor.document, diagnosticCollection);
      }
    })
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event: vscode.TextDocumentChangeEvent) => {
      if (IntelliSenseUtility.isDigitalTwinFile(event.document)) {
        if (pendingDiagnostic) {
          clearTimeout(pendingDiagnostic);
        }
        pendingDiagnostic = setTimeout(
          () => diagnosticProvider.updateDiagnostics(event.document, diagnosticCollection),
          Constants.DEFAULT_TIMER_MS
        );
      }
    })
  );
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((document: vscode.TextDocument) => {
      if (IntelliSenseUtility.isDigitalTwinFile(document)) {
        diagnosticCollection.delete(document.uri);
      }
    })
  );
  // send usage telemetry when file is opened
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document: vscode.TextDocument) => {
      if (IntelliSenseUtility.isDigitalTwinFile(document)) {
        const modelContent: ModelContent | undefined = IntelliSenseUtility.parseDigitalTwinModel(document.getText());
        if (modelContent) {
          const telemetryContext: TelemetryContext = TelemetryContext.startNew();
          telemetryContext.properties.dtdlVersion = modelContent.version.toString();
          telemetryContext.end();
          telemetryClient.sendEvent(EventType.OpenModelFile, telemetryContext);
        }
      }
    })
  );
}

function initCommand(
  context: vscode.ExtensionContext,
  telemetryClient: TelemetryClient,
  outputChannel: ColorizedChannel,
  nsat: NSAT,
  enableSurvey: boolean,
  event: EventType,
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  callback: (...args: any[]) => Promise<any>
): void {
  context.subscriptions.push(
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    vscode.commands.registerCommand(event, async (...args: any[]) => {
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
        telemetryClient.sendEvent(event, telemetryContext);
        outputChannel.show();
        if (enableSurvey) {
          nsat.takeSurvey(context);
        }
      }
    })
  );
}

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = new ColorizedChannel(Constants.CHANNEL_NAME);
  const telemetryClient = new TelemetryClient(context);
  const nsat = new NSAT(Constants.NSAT_SURVEY_URL, telemetryClient);
  const deviceModelManager = new DeviceModelManager(context, outputChannel);

  telemetryClient.sendEvent(Constants.EXTENSION_ACTIVATED_MSG);
  context.subscriptions.push(outputChannel);
  context.subscriptions.push(telemetryClient);

  // register events
  initIntelliSense(context, telemetryClient);
  initCommand(
    context,
    telemetryClient,
    outputChannel,
    nsat,
    true,
    EventType.CreateInterface,
    async (): Promise<void> => {
      return deviceModelManager.createModel(ModelType.Interface);
    }
  );
}

export function deactivate(): void {
  // Do nothing.
}
