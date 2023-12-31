import { Collection } from "discord.js";
import { readdir } from "fs/promises";
import { existsSync } from "node:fs";
import path from "path";
import logger from "./logger.js";

export default class Registry<I> extends Collection<string, I> {
	public async loadFromDirectory(directory: string, nameTransformer?: (name: string) => string): Promise<void> {
		if (!existsSync(directory)) return;
		for (const filename of await readdir(directory)) {
			if (!filename.endsWith("ts") && !filename.endsWith("js")) continue;

			const importName = path.basename(filename, path.extname(filename));
			const { default: thing } = (await import(`./${path.basename(directory)}/${importName}.js`)) as {
				default: I | I[] | undefined;
			};
			if (thing === undefined)
				logger.warn(
					`Failed to import registry item ${nameTransformer?.(importName) ?? importName}${
						nameTransformer ? ` (${importName})` : ""
					}, no default export`,
				);
			else if (Array.isArray(thing))
				thing.forEach((thingItem, i) =>
					this.set(`${nameTransformer?.(importName) ?? importName}${i}`, thingItem),
				);
			else this.set(nameTransformer?.(importName) ?? importName, thing);
		}
	}
}
