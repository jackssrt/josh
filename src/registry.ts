import { Collection } from "discord.js";
import { readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import logger from "./utils/Logger.js";

export default class Registry<I> extends Collection<string, I> {
	public async loadFromDirectory(directory: string, nameTransformer?: (name: string) => string): Promise<void> {
		if (!existsSync(directory)) return;
		for (const filename of await readdir(directory)) {
			if (!filename.endsWith("ts") && !filename.endsWith("js")) continue;

			const importName = path.basename(filename, path.extname(filename));
			const transformedName = nameTransformer?.(importName) ?? importName;
			const { default: thing } = (await import(`./${path.basename(directory)}/${importName}.js`)) as {
				default: I | I[] | undefined;
			};
			if (thing === undefined)
				logger.warn(
					`Failed to import registry item ${transformedName}${
						nameTransformer ? ` (${importName})` : ""
					}, no default export`,
				);
			else if (Array.isArray(thing))
				for (const [i, thingItem] of thing.entries()) this.set(`${transformedName}${i}`, thingItem);
			else this.set(transformedName, thing);
		}
	}
}
