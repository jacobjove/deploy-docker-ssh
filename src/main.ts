import { execSync } from "child_process";
import path from "path";
import { Inputs, getInputs } from "./inputs";
import * as core from "@actions/core";
import * as fs from "fs";
import { nanoid } from "nanoid";

function execInRealTime(
  ...args: Parameters<typeof execSync>
): ReturnType<typeof execSync> {
  const [command, options] = args;
  return execSync(command, {
    shell: "/bin/bash",
    stdio: "inherit",
    ...(options ?? {}),
  });
}

async function run(): Promise<void> {
  if (!process.env.SSH_AUTH_SOCK) {
    core.setFailed(
      `SSH agent is not initialized. Please use the ssh-agent action: https://github.com/webfactory/ssh-agent`
    );
    return;
  }
  const GITHUB_WORKSPACE = process.env.GITHUB_WORKSPACE;
  if (!GITHUB_WORKSPACE) {
    core.setFailed("GITHUB_WORKSPACE is not set.");
    return;
  } else if (!fs.existsSync(GITHUB_WORKSPACE)) {
    core.setFailed(`${GITHUB_WORKSPACE} does not exist.`);
    return;
  }
  process.chdir(GITHUB_WORKSPACE);
  const inputs: Inputs = await getInputs();
  // Instead of initializing the SSH agent here, use the ssh-agent action:
  // https://github.com/webfactory/ssh-agent
  // core.info("Adding GitHub to known hosts...");
  // execInRealTime("mkdir -p ~/.ssh");
  // execInRealTime(`ssh-agent -a "${inputs.sshAuthSock}" > /dev/null`);
  // execInRealTime(`ssh-keyscan github.com >> ~/.ssh/known_hosts`);
  // execInRealTime(`ssh-add - <<< "${inputs.sshPrivateKey}"`);
  const distDirPath = path.join(GITHUB_WORKSPACE, `tmp-${nanoid()}`);
  fs.mkdirSync(distDirPath, { recursive: true });
  const sshPartial = `ssh -o StrictHostKeyChecking=no -p "${inputs.sshPort}"`;
  core.info("Confirming target directory exists on remote server...");
  const successMessage = "Confirmed target directory exists.";
  const targetDirCheckOutput = execSync(
    `if ${sshPartial} ${inputs.user}@${inputs.host} "[ -d ${inputs.targetDir} ]"; 
    then echo "${successMessage}"; 
    else echo "Target directory ${inputs.targetDir} does not exist."; fi`
  )
    .toString()
    .trim();
  if (targetDirCheckOutput !== successMessage) {
    core.setFailed(targetDirCheckOutput);
    return;
  }
  if (inputs.files) {
    const filepaths = inputs.files
      .split(/[\s\n]+/)
      .map((filepath) => path.join(inputs.sourceDir, filepath));
    core.info(`To be transported:\n${filepaths.join("\n")}`);
    for (const filepath of filepaths) {
      if (!fs.existsSync(filepath)) {
        core.setFailed(`${filepath} does not exist.`);
        return;
      }
      const destDir = path.join(distDirPath, path.dirname(filepath));
      fs.mkdirSync(destDir, { recursive: true });
      execInRealTime(`cp -r ${filepath} ${destDir}`);
    }
    core.info(`Prepared distribution directory with the following contents:`);
    execInRealTime(`ls -a ${distDirPath}`);
    core.info(
      `Syncing distribution directory to ${inputs.host}:${inputs.targetDir} ...`
    );
    execInRealTime(
      `rsync -rPv -e "${sshPartial}" "${distDirPath}/" "${inputs.user}@${inputs.host}:${inputs.targetDir}"`
    );
  }
  core.info(`Starting SSH connection with ${inputs.host} ...`);
  const command = `cd '${inputs.targetDir}' && ${inputs.command}`;
  core.info(command);
  try {
    execInRealTime(
      `${sshPartial} "${inputs.user}@${inputs.host}" "${command}"`
    );
  } catch (err) {
    core.setFailed(err instanceof Error ? err.message : `${err}`);
  }
}

run();
