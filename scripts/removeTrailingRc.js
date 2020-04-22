const fs = require("fs");


const packageJson = JSON.parse(fs.readFileSync("package.json"));
const indexOfDash = packageJson.version.indexOf('-');

if (indexOfDash === -1) {
  // dash was not found.
  process.exit(0);
}

packageJson.version = packageJson.version.substring(0, indexOfDash);

fs.writeFileSync("package.json", JSON.stringify(packageJson, null, 2) + "\n");
