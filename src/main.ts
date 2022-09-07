import { execSync } from "child_process";
import path from "path";
import { Inputs, getInputs } from "./inputs";
import * as core from "@actions/core";
import * as fs from "fs";
import { nanoid } from "nanoid";

function execInRealTime(command: string): ReturnType<typeof execSync> {
  return execSync(command, { shell: "/bin/bash", stdio: "inherit" });
}

async function run(): Promise<void> {
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
  core.info("Adding GitHub to known hosts...");
  execInRealTime("mkdir -p ~/.ssh");
  execInRealTime(`ssh-agent -a "${inputs.sshAuthSock}" > /dev/null`);
  execInRealTime(`ssh-keyscan github.com >> ~/.ssh/known_hosts`);
  execInRealTime(`ssh-add - <<< "${inputs.sshPrivateKey}"`);
  const distDirPath = path.join(GITHUB_WORKSPACE, `tmp-${nanoid()}`);
  fs.mkdirSync(distDirPath, { recursive: true });
  const sshPartial = `ssh -o StrictHostKeyChecking=no -p "${inputs.sshPort}"`;
  if (inputs.files) {
    const filesToTransport = inputs.files.split(/[\s\n]+/);
    core.info(
      `Bundling the following to be transported:\n${filesToTransport.join(" ")}`
    );
    for (const filepath of filesToTransport) {
      const sourcePath = path.join(GITHUB_WORKSPACE, filepath);
      if (!fs.existsSync(sourcePath)) {
        core.setFailed(`${sourcePath} does not exist.`);
        return;
      }
      const destDir = path.join(distDirPath, path.dirname(filepath));
      fs.mkdirSync(destDir, { recursive: true });
      execInRealTime(`cp -r ${sourcePath} ${destDir}`);
    }
    core.info(`Prepared distribution directory with the following contents:`);
    execInRealTime(`ls -a ${distDirPath}`);
    core.info(
      `Syncing distribution directory to ${inputs.host}:${inputs.target} ...`
    );
    execInRealTime(
      `rsync -rPv -e "${sshPartial}" "${distDirPath}/" "${inputs.user}@${inputs.host}:${inputs.target}"`
    );
  }
  core.info(`Starting SSH connection with ${inputs.host} ...`);
  const command = `cd ${inputs.target} && ${inputs.command}`;
  try {
    execInRealTime(
      `${sshPartial} "${inputs.user}@${inputs.host}" "${command}"`
    );
  } catch (err) {
    core.setFailed(err instanceof Error ? err.message : `${err}`);
  }
}

run();
