import { execFile as _execFile } from "child_process";
import { promisify } from "util";
import { IS_PROD } from "./env.js";

const execFile = promisify(_execFile);

export async function installFont() {
	await execFile("./scripts/installSplatoon2Font.sh");
}

export default async function installDependencies() {
	await Promise.all([IS_PROD && installFont()]);
}
