const fs = require("fs");

const PACKAGE_JSON_FILENAME = "package.json";

if (process.env.BUILD_SOURCEBRANCH) {
  const IS_PROD = new RegExp(process.env.PROD_TAG).test(process.env.BUILD_SOURCEBRANCH);
  if (IS_PROD) {
    const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_FILENAME));
    packageJson.aiKey = process.env.PROD_AIKEY;
    fs.writeFileSync(PACKAGE_JSON_FILENAME, JSON.stringify(packageJson, null, 2));
  }
}
