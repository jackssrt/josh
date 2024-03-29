import { execFile as _execFile } from "node:child_process";
import { promisify } from "node:util";
import { IS_PROD } from "./env.js";
import { parallel } from "./utils/promise.js";

const execFile = promisify(_execFile);

export async function installFont() {
	await execFile("./scripts/installSplatoon2Font.sh");
}

export default async function installDependencies() {
	await parallel(IS_PROD && installFont());
}
