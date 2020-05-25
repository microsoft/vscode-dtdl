// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { IntelliSenseUtility } from "../intelliSense/intelliSenseUtility";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const vscode = require("../../__mocks__/vscode");

describe("IntelliSense utility", () => {
  const context = vscode.ExtensionContext;

  beforeAll(() => {
    return IntelliSenseUtility.initGraph(context);
  });

  test("parse DigitalTwin model with normal JSON file", () => {
    const text = `{ "@type": "Interface" }`;
    expect(IntelliSenseUtility.parseDigitalTwinModel(text)).toBeUndefined();
  });
});
