import * as core from "@actions/core";

export interface Inputs {
  sshAuthSock: string;
  host: string;
  user: string;
  target: string;
  files: string;
  sshPort: string;
  sshPrivateKey: string;
  command: string;
}

export async function getInputs(): Promise<Inputs> {
  const inputs: Inputs = {
    sshAuthSock:
      core.getInput("ssh-auth-sock", { required: false }) ||
      "/tmp/ssh_agent.sock",
    host: core.getInput("host", { required: true }),
    user: core.getInput("user", { required: true }),
    target: core.getInput("target", { required: true }),
    files: core.getInput("files", { required: true }),
    sshPort: core.getInput("ssh-port", { required: false }) || "22",
    sshPrivateKey: core.getInput("ssh-private-key", { required: true }),
    command:
      core.getInput("command", { required: false }) ||
      `echo "Connected successfully. To run commands after connecting, set the 'command' input."`,
  };
  return inputs;
}
