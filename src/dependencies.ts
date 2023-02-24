import axios from "axios";
import consola from "consola";
import { getFonts } from "font-list";
import { existsSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { IS_REPLIT } from "./env.js";

export async function installFont() {
	if ((await getFonts()).includes("Splatoon2"))
		// already installed, nothing to do
		return;

	const fontFile = await axios.get<NodeJS.ArrayBufferView>("https://frozenpandaman.github.io/Splatoon2.otf", {
		responseType: "arraybuffer",
	});
	// placing fonts into ~/.fonts is deprecated
	// but there's no other way to install fonts on replit
	if (!existsSync("~/.fonts")) await mkdir("~/.fonts");
	await writeFile("~/.fonts/Splatoon2.otf", fontFile.data);
	consola.success("Successfully installed Splatoon2 font");
}

export default async function installDependencies() {
	await Promise.all([IS_REPLIT && installFont()]);
}
