const fs = require("fs");

console.log(process.argv);

const cnt = process.argv.length;

if (cnt % 2 === 1) {
  console.log("Format error, expect even argv length!");
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync("package.json"));

for (var i = 3; i < cnt; i += 2) {
  packageJson[process.argv[i - 1]] = process.argv[i];
}

fs.writeFileSync("package.json", JSON.stringify(packageJson, null, 2) + "\n");
