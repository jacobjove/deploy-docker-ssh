/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable import/no-commonjs */
const core = require("@actions/core");
const { execSync } = require("child_process");

try {
  // Kill the started SSH agent
  core.info("Stopping SSH agent...");
  execSync("ssh-agent -k");
} catch (error) {
  core.info(String(error));
}
