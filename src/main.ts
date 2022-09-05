import { execSync } from "child_process";
import path from "path";

const ENTRYPOINT_SCRIPT_PATH: string = path.join(__dirname, "../entrypoint.sh");

async function run(): Promise<void> {
  execSync(`bash ${ENTRYPOINT_SCRIPT_PATH}`, { env: process.env });
}

run();
