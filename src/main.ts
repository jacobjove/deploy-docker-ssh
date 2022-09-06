import { exec } from "child_process";
import path from "path";
import * as core from "@actions/core";

const ENTRYPOINT_SCRIPT_PATH: string = path.join(__dirname, "../entrypoint.sh");

async function run(): Promise<void> {
  process.env.INPUT_SSH_AUTH_SOCK =
    core.getInput("ssh-auth-sock", {
      required: false,
    }) || "/tmp/ssh_agent.sock";
  process.env.INPUT_HOST = core.getInput("host", { required: true });
  process.env.INPUT_USER = core.getInput("user", { required: true });
  process.env.INPUT_TARGET = core.getInput("target", { required: true });
  process.env.INPUT_FILES = core.getInput("files", { required: false });
  process.env.INPUT_SSH_PORT =
    core.getInput("ssh-port", { required: false }) || "22";
  process.env.INPUT_SSH_PRIVATE_KEY = core.getInput("ssh-private-key", {
    required: true,
  });
  process.env.INPUT_COMMAND =
    core.getInput("command", { required: false }) ||
    `set -a; source .env; set +a; docker compose pull && docker compose up -d`;
  core.info("Running entrypoint script: " + ENTRYPOINT_SCRIPT_PATH);
  exec(
    `bash ${ENTRYPOINT_SCRIPT_PATH}`,
    { env: process.env },
    (err, stdout, stderr) => {
      // https://github.com/actions/toolkit/tree/main/packages/core#annotations
      core.info(stdout);
      if (stderr) core.warning(stderr);
      if (err) core.setFailed(err.message);
    }
  );
}

run();
