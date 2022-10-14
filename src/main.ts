import { execSync } from "child_process";
import path from "path";
import { Inputs, getInputs } from "./inputs";
import * as core from "@actions/core";
import * as fs from "fs";
import { nanoid } from "nanoid";

// const KEY_NAME = "gha";

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

  // Ensure the home directory exists.
  const homeDir = process.env.HOME || path.resolve("~");
  if (!homeDir) {
    core.setFailed("HOME is not set.");
    return;
  } else if (!fs.existsSync(homeDir)) {
    core.setFailed(`Home directory (${homeDir}) does not exist.`);
    return;
  }
  core.info(`Home directory: ${homeDir}`);

  const sshDir = path.join(homeDir, ".ssh");
  // Ensure the SSH directory exists.
  fs.mkdirSync(sshDir, {
    recursive: true,
    mode: 0o700,
  });
  core.info(`SSH directory: ${sshDir}`);

  // Read inputs.
  const inputs: Inputs = await getInputs();

  const sshAuthSock = inputs.sshAuthSock;
  let sshAuthSockPath = sshAuthSock;
  if (!path.isAbsolute(sshAuthSock)) {
    if (sshAuthSock.startsWith("~")) {
      sshAuthSockPath = path.join(homeDir, sshAuthSock.slice(1));
    } else {
      sshAuthSockPath = path.join(sshDir, sshAuthSock);
    }
  }
  if (!fs.existsSync(sshAuthSockPath)) {
    execInRealTime(
      `touch ${sshAuthSockPath} || echo "Failed to create sock file at ${sshAuthSockPath}"`
    );
  }

  // Set known hosts and private key.
  const knownHostsFilepath = path.join(sshDir, "known_hosts");
  execInRealTime(
    `touch ${knownHostsFilepath}; 
    ssh-keyscan github.com >> ${knownHostsFilepath} &&
    ssh-keyscan -p ${inputs.sshPort} -H ${inputs.host} >> ${knownHostsFilepath} && 
    ssh-agent -a "${sshAuthSockPath}" > /dev/null && 
    ssh-add - <<< "${inputs.sshPrivateKey}"`
  );
  core.exportVariable("SSH_AUTH_SOCK", inputs.sshAuthSock);

  // Set private key.
  // const keyFilepath = path.join(sshDir, KEY_NAME);
  // fs.writeFileSync(keyFilepath, inputs.sshPrivateKey, { flag: "wx" });

  // Set permissions on the home directory.
  execInRealTime(`chmod og-rw ${homeDir}`);

  const sshPartial = `ssh -o StrictHostKeyChecking=no -p "${inputs.sshPort}"`;

  // Confirm able to connect.
  core.info("Checking connection...");
  let successMessage = "OK";
  const checkOutput = execSync(
    `${sshPartial} -o BatchMode=yes -o ConnectTimeout=5 ${inputs.user}@${inputs.host} echo "${successMessage}"`
  )
    .toString()
    .trim();
  core.info(`Result: ${checkOutput}`);

  // Confirm the target directory exists on the server.
  core.info("\nConfirming target directory exists on remote server...");
  successMessage = "Confirmed target directory exists.";
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
    core.info(`\nTo be transported:\n${relativeFilepaths.join("\n")}`);
    for (const filepath of relativeFilepaths) {
      if (!fs.existsSync(filepath)) {
        core.setFailed(`${filepath} does not exist.`);
        return;
      }
      const destDir = path.join(distDirPath, path.dirname(filepath));
      fs.mkdirSync(destDir, { recursive: true });
      execInRealTime(`cp -r ${filepath} ${destDir}`);
    }
    core.info(`\nPrepared distribution directory with the following contents:`);
    execInRealTime(`ls -a ${distDirPath}`);

    // Sync the temporary directory to the target directory on the server.
    core.info(
      `\nSyncing distribution directory to ${inputs.host}:${inputs.targetDir} ...`
    );
    execInRealTime(
      `rsync -rPv -e "${sshPartial}" "${distDirPath}/" "${inputs.user}@${inputs.host}:${inputs.targetDir}"`
    );
  }

  // Execute the remote command.
  core.info(`\nStarting SSH connection with ${inputs.host} ...`);
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
