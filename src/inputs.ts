import * as core from "@actions/core";

export interface Inputs {
  host: string;
  user: string;
  sourceDir: string;
  targetDir: string;
  files?: string;
  sshPort: string;
  sshPrivateKey: string;
  command: string;
}

export async function getInputs(): Promise<Inputs> {
  const inputs: Inputs = {
    host: core.getInput("host", { required: true }),
    user: core.getInput("user", { required: true }),
    sourceDir: core.getInput("source-dir", { required: false }),
    targetDir: core.getInput("target-dir", { required: true }),
    files: core.getInput("files", { required: false }),
    sshPort: core.getInput("ssh-port", { required: false }) || "22",
    sshPrivateKey: core.getInput("ssh-private-key", { required: true }),
    command:
      core.getInput("command", { required: false }) ||
      `echo "Connected successfully. To run commands after connecting, set the 'command' input."`,
  };
  return inputs;
}
