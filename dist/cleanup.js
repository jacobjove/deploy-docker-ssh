const { execSync } = require("child_process");

try {
  // Kill the SSH agent.
  execSync("ssh-agent -k");
} catch (error) {
  console.log(String(error));
}
