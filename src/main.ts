import { execSync } from "child_process";
import path from "path";
import { Inputs, getInputs } from "./inputs";
import * as core from "@actions/core";
import * as fs from "fs";
import { nanoid } from "nanoid";

const KEY_NAME = "gha";

async function run(): Promise<void> {
  // Verify workspace structure.
  const GITHUB_WORKSPACE = process.env.GITHUB_WORKSPACE;
  if (!GITHUB_WORKSPACE) {
    core.setFailed("GITHUB_WORKSPACE is not set.");
    return;
  } else if (!fs.existsSync(GITHUB_WORKSPACE)) {
    core.setFailed(`${GITHUB_WORKSPACE} does not exist.`);
    return;
  }
  const homeDir = process.env.HOME || path.resolve("~");
  if (!homeDir) {
    core.setFailed("HOME is not set.");
    return;
  }
  const sshDir = path.join(homeDir, ".ssh");

  // Read inputs.
  const inputs: Inputs = await getInputs();

  // Set known hosts.
  const knownHostsFilepath = path.join(sshDir, "known_hosts");
  if (!fs.existsSync(knownHostsFilepath)) {
    fs.writeFileSync(knownHostsFilepath, "");
  }
  execInRealTime(
    `ssh-keyscan -p ${inputs.sshPort} -H ${inputs.host} >> ${knownHostsFilepath}`
  );

  // Set private key.
  const keyFilepath = path.join(sshDir, KEY_NAME);
  fs.writeFileSync(keyFilepath, inputs.sshPrivateKey);

  const sshPartial = `ssh -o StrictHostKeyChecking=no -p "${inputs.sshPort}"`;

  // Confirm the target directory exists on the server.
  core.info("Confirming target directory exists on remote server...");
  const successMessage = "Confirmed target directory exists.";
  const targetDirCheckOutput = execSync(
    `if ${sshPartial} ${inputs.user}@${inputs.host} "[ -d ${inputs.targetDir} ]"; 
    then echo "${successMessage}"; 
    else echo "Target directory ${inputs.targetDir} does not exist."; fi`
  )
    .toString()
    .trim();
  if (!targetDirCheckOutput.includes(successMessage)) {
    core.setFailed(targetDirCheckOutput);
    return;
  }

  if (inputs.files) {
    // Generate a temporary directory to hold only the deployable files.
    const distDirPath = path.join(GITHUB_WORKSPACE, `tmp-${nanoid()}`);
    fs.mkdirSync(distDirPath, { recursive: true });

    // Enter the source directory.
    const sourceDir = path.resolve(GITHUB_WORKSPACE, inputs.sourceDir);
    if (!fs.existsSync(sourceDir)) {
      core.setFailed(`${sourceDir} does not exist.`);
      return;
    }
    process.chdir(sourceDir);

    // Copy the deployable files from the source directory to the temporary directory.
    const relativeFilepaths = inputs.files.split(/[\s\n]+/);
    core.info(`To be transported:\n${relativeFilepaths.join("\n")}`);
    for (const filepath of relativeFilepaths) {
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

    // Sync the temporary directory to the target directory on the server.
    core.info(
      `Syncing distribution directory to ${inputs.host}:${inputs.targetDir} ...`
    );
    execInRealTime(
      `rsync -rPv -e "${sshPartial}" "${distDirPath}/" "${inputs.user}@${inputs.host}:${inputs.targetDir}"`
    );
  }

  // Execute the remote command.
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
