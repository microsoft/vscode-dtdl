// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Utility } from "../common/utility";
import { Constants } from "../common/constants";
import { ModelType } from "../deviceModel/deviceModelManager";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { pathExists } = require("fs-extra");

jest.mock("fs-extra");

describe("Utility", () => {
  const folder = "root";
  const name = "test";

  test("validate model name successfully", async () => {
    pathExists.mockResolvedValueOnce(false);
    const message = await Utility.validateModelName(name, ModelType.Interface, folder);
    expect(message).toBeUndefined();
  });

  test("validate model name when it is not allowed", async () => {
    const message = await Utility.validateModelName("my-interface", ModelType.Interface, folder);
    expect(message).toBe("Name can only contain " + Constants.MODEL_NAME_REGEX_DESCRIPTION);
  });
});
