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
import { MessageType, UI } from "./views/ui";

export function activate(context: vscode.ExtensionContext) {
  const outputChannel = new ColorizedChannel(Constants.CHANNEL_NAME);
  const telemetryClient = new TelemetryClient(context);
  const nsat = new NSAT(Constants.NSAT_SURVEY_URL, telemetryClient);
  const deviceModelManager = new DeviceModelManager(context, outputChannel);

  telemetryClient.sendEvent(Constants.EXTENSION_ACTIVATED_MSG);

  initCommand(
    context,
    telemetryClient,
    outputChannel,
    nsat,
    true,
    Command.CREATE_INTERFACE,
    (): Promise<void> => {
      return deviceModelManager.createModel(ModelType.Interface);
    },
  );

  initCommand(
    context,
    telemetryClient,
    outputChannel,
    nsat,
    true,
    Command.CREATE_CAPABILITY_MODEL,
    (): Promise<void> => {
      return deviceModelManager.createModel(ModelType.CapabilityModel);
    },
  );
}

// this method is called when your extension is deactivated
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
    vscode.commands.registerCommand(command.id, async (...args: any[]) => {
      const telemetryContext: TelemetryContext = telemetryClient.createContext();
      telemetryClient.sendEvent(`${command.id}.start`);
      outputChannel.show();
      outputChannel.start(`Trigger command ${command.description}`);

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
        telemetryClient.sendEvent(`${command.id}.end`, telemetryContext);
        outputChannel.end(`Complete command ${command.description}`);
        if (enableSurvey) {
          nsat.takeSurvey(context);
        }
      }
    }),
  );
}
