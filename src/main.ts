import { execSync } from "child_process";
import path from "path";

const ENTRYPOINT_SCRIPT = path.join(__dirname, "../entrypoint.sh");

async function run(): Promise<void> {
  execSync(`bash ${ENTRYPOINT_SCRIPT}`, { env: process.env });
}

run();
