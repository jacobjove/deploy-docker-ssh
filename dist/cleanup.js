/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable import/no-commonjs */
const { execSync } = require("child_process");

try {
  // Kill the started SSH agent
  execSync("ssh-agent -k");
} catch (error) {
  console.log(String(error));
}
