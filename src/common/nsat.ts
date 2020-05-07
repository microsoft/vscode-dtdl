// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { commands, ExtensionContext, Memento, Uri, window } from "vscode";
import { TelemetryClient } from "./telemetryClient";

const PROBABILITY = 1;
const SESSION_COUNT_THRESHOLD = 2;
const SESSION_COUNT_KEY = "nsat/sessionCount";
const LAST_SESSION_DATE_KEY = "nsat/lastSessionDate";
const TAKE_SURVEY_DATE_KEY = "nsat/takeSurveyDate";
const DONT_SHOW_DATE_KEY = "nsat/dontShowDate";
const SKIP_VERSION_KEY = "nsat/skipVersion";
const IS_CANDIDATE_KEY = "nsat/isCandidate";

/**
 * User survey client
 */
export class NSAT {
  constructor(private readonly surveyUrl: string, private readonly telemetryClient: TelemetryClient) {}

  /**
   * ask user to take survey
   * @param context extension context
   */
  public async takeSurvey(context: ExtensionContext) {
    const globalState: Memento = context.globalState;
    if (!globalState) {
      return;
    }
    const skipVersion: string = globalState.get(SKIP_VERSION_KEY, "");
    if (skipVersion) {
      return;
    }
    const date: string = new Date().toDateString();
    const lastSessionDate: string = globalState.get(LAST_SESSION_DATE_KEY, new Date(0).toDateString());
    if (date === lastSessionDate) {
      return;
    }
    const sessionCount: number = globalState.get(SESSION_COUNT_KEY, 0) + 1;
    await globalState.update(LAST_SESSION_DATE_KEY, date);
    await globalState.update(SESSION_COUNT_KEY, sessionCount);
    if (sessionCount < SESSION_COUNT_THRESHOLD) {
      return;
    }
    const isCandidate: boolean = globalState.get(IS_CANDIDATE_KEY, false) || Math.random() < PROBABILITY;
    await globalState.update(IS_CANDIDATE_KEY, isCandidate);
    const extensionVersion: string = this.telemetryClient.extensionVersion;
    if (!isCandidate) {
      await globalState.update(SKIP_VERSION_KEY, extensionVersion);
      return;
    }
    const take = {
      title: "Take Survey",
      run: async () => {
        this.telemetryClient.sendEvent("nsat.survey/takeShortSurvey");
        commands.executeCommand(
          "vscode.open",
          Uri.parse(
            `${this.surveyUrl}?o=${encodeURIComponent(process.platform)}&v=${encodeURIComponent(extensionVersion)}`,
          ),
        );
        await globalState.update(IS_CANDIDATE_KEY, false);
        await globalState.update(SKIP_VERSION_KEY, extensionVersion);
        await globalState.update(TAKE_SURVEY_DATE_KEY, date);
      },
    };
    const remind = {
      title: "Remind Me Later",
      run: async () => {
        this.telemetryClient.sendEvent("nsat.survey/remindMeLater");
        await globalState.update(SESSION_COUNT_KEY, 0);
      },
    };
    const never = {
      title: "Don't Show Again",
      run: async () => {
        this.telemetryClient.sendEvent("nsat.survey/dontShowAgain");
        await globalState.update(IS_CANDIDATE_KEY, false);
        await globalState.update(SKIP_VERSION_KEY, extensionVersion);
        await globalState.update(DONT_SHOW_DATE_KEY, date);
      },
    };
    this.telemetryClient.sendEvent("nsat.survey/userAsked");
    const button = await window.showInformationMessage(
      "Do you mind taking a quick feedback survey about DTDL Extension for VS Code?",
      take,
      remind,
      never,
    );
    await (button || remind).run();
  }
}
