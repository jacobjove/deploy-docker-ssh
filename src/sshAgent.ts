// Inspired by: https://github.com/webfactory/ssh-agent/blob/master/index.js

import * as core from "@actions/core";
import * as child_process from "child_process";
import * as fs from "fs";
import * as crypto from "crypto";
import * as path from "path";
import { home, sshAgent, sshAdd } from "./paths";

// TODO: https://github.com/webfactory/ssh-agent/blob/master/cleanup.js

const GITHUB_KNOWN_HOSTS = [
  "github.com ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBEmKSENjQEezOmxkZMy7opKgwFB9nkt5YRrYMjNuG5N87uRgg6CLrbo5wAdT/y6v0mKV0U2w0WZ2YB/++Tpockg=",
  "github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl",
  "github.com ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAQEAq2A7hRGmdnm9tUDbO9IDSwBK6TbQa+PXYPCPy6rbTrTtw7PHkccKrpp0yVhp5HdEIcKr6pLlVDBfOLX9QUsyCOV0wzfjIJNlGEYsdlLJizHhbn2mUjvSAHQqZETYP81eFzLQNnPHt4EVVUh7VfDESU84KezmD5QlWpXLmvU31/yMf+Se8xhHTvKSCZIFImWwoG6mbUoWf9nzpIoaSjB+weqqUUmpaaasXVal72J+UX2B+2RPW3RcT0eOzQgqlJL3RKrTJvdsjE3JEAvGq3lGHSZXy28G3skua2SmVi/w4yCE6gbODqnTWlg7+wC604ydGXA8VJiS5ap43JXiUFFAaQ==",
];

try {
  const privateKey = core.getInput("ssh-private-key");

  const homeSshDir = path.join(home, ".ssh");
  const knownHostsFilePath = path.join(homeSshDir, "known_hosts");

  core.info(`Adding GitHub.com keys to ${homeSshDir}/known_hosts ...`);

  fs.mkdirSync(knownHostsFilePath, { recursive: true });
  for (const knownHost of GITHUB_KNOWN_HOSTS) {
    fs.appendFileSync(knownHostsFilePath, `\n${knownHost}\n`);
  }

  core.info("Starting ssh-agent ...");

  const authSock = core.getInput("ssh-auth-sock");
  const sshAgentArgs = authSock && authSock.length > 0 ? ["-a", authSock] : [];

  // Extract auth socket path and agent pid and set them as job variables
  const lines = child_process
    .execFileSync(sshAgent, sshAgentArgs)
    .toString()
    .split("\n");
  for (const line of lines) {
    const matches = /^(SSH_AUTH_SOCK|SSH_AGENT_PID)=(.*); export \1/.exec(line);
    if (matches && matches.length > 0) {
      // This will also set process.env accordingly, so changes take effect for this script
      core.exportVariable(matches[1], matches[2]);
      core.info(`${matches[1]}=${matches[2]}`);
    }
  }

  core.info("Adding private key(s) to agent ...");

  for (const key of privateKey.split(/(?=-----BEGIN)/)) {
    child_process.execFileSync(sshAdd, ["-"], { input: `${key.trim()}\n` });
  }

  core.info("Key(s) added:");

  child_process.execFileSync(sshAdd, ["-l"], { stdio: "inherit" });

  core.info("Configuring deployment key(s) ...");

  const keys = child_process
    .execFileSync(sshAdd, ["-L"])
    .toString()
    .split(/\r?\n/);

  for (const key of keys) {
    const parts = key.match(/\bgithub\.com[:/]([_.a-z0-9-]+\/[_.a-z0-9-]+)/i);

    if (!parts) {
      core.info(
        `Comment for (public) key '${key}' does not match GitHub URL pattern. Not treating it as a GitHub deploy key.`
      );
      continue;
    }

    const sha256 = crypto.createHash("sha256").update(key).digest("hex");
    const ownerAndRepo = parts[1].replace(/\.git$/, "");

    fs.writeFileSync(`${homeSshDir}/key-${sha256}`, `${key}\n`, {
      mode: "600",
    });

    child_process.execSync(
      `git config --global --replace-all url."git@key-${sha256}.github.com:${ownerAndRepo}".insteadOf "https://github.com/${ownerAndRepo}"`
    );
    child_process.execSync(
      `git config --global --add url."git@key-${sha256}.github.com:${ownerAndRepo}".insteadOf "git@github.com:${ownerAndRepo}"`
    );
    child_process.execSync(
      `git config --global --add url."git@key-${sha256}.github.com:${ownerAndRepo}".insteadOf "ssh://git@github.com/${ownerAndRepo}"`
    );

    const sshConfig =
      `\nHost key-${sha256}.github.com\n` +
      `    HostName github.com\n` +
      `    IdentityFile ${homeSshDir}/key-${sha256}\n` +
      `    IdentitiesOnly yes\n`;

    fs.appendFileSync(`${homeSshDir}/config`, sshConfig);

    core.info(
      `Added deploy-key mapping: Use identity '${homeSshDir}/key-${sha256}' for GitHub repository ${ownerAndRepo}`
    );
  }
} catch (error) {
  if (error instanceof Error) {
    // if (error.code === "ENOENT") {
    //   core.info(
    //     `The '${error.path}' executable could not be found. Please make sure it is on your PATH and/or the necessary packages are installed.`
    //   );
    //   core.info(`PATH is set to: ${process.env.PATH}`);
    // }
    core.setFailed(error.message);
  } else {
    core.setFailed(`${error}`);
  }
}
