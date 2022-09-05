import { exec } from "child_process";
import path from "path";
import * as core from "@actions/core";

const ENTRYPOINT_SCRIPT_PATH: string = path.join(__dirname, "../entrypoint.sh");

async function run(): Promise<void> {
  core.info("Running entrypoint script: " + ENTRYPOINT_SCRIPT_PATH);
  console.log("Running entrypoint script: " + ENTRYPOINT_SCRIPT_PATH);
  exec(
    `bash ${ENTRYPOINT_SCRIPT_PATH}`,
    { env: process.env },
    (err, stdout, stderr) => {
      // https://github.com/actions/toolkit/tree/main/packages/core#annotations
      if (err) {
        core.error(err);
      } else {
        // the *entire* stdout and stderr (buffered)
        console.log(`stdout: ${stdout}`);
        console.log(`stderr: ${stderr}`);
      }
    }
  );
}

run();
