import { Collection } from "discord.js";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import type { Command } from "./commandHandler/command.js";
import type { Subcommand } from "./commandHandler/subcommand.js";
import type { SubcommandGroup } from "./commandHandler/subcommandGroup.js";
import { IS_BUILT } from "./env.js";
import Registry from "./registry.js";
import logger from "./utils/Logger.js";
import { commands, fileURI } from "./utils/paths.js";

export type CommandRegistryItem = Command & {
	subcommandGroups: Collection<string, CommandRegistrySubcommandGroup>;
	subcommands: Collection<string, CommandRegistrySubcommand>;
};
export type CommandRegistrySubcommandGroup = {
	data: SubcommandGroup;
	subcommands: Collection<string, CommandRegistrySubcommand>;
};
export type CommandRegistrySubcommand = Subcommand;

export default class CommandRegistry extends Registry<CommandRegistryItem> {
	/**
	 * Utility function to import a file from the commands folder, returns the default import.
	 * @param parts Path parts to the file, do not include the file extension
	 * @returns The default export of the imported file
	 */
	public async importFile<T>(...parts: string[]): Promise<T | undefined> {
		const { default: thing } = (await import(
			fileURI(commands`${parts.join(path.sep)}.${IS_BUILT ? "js" : "ts"}`)
		)) as {
			default: T | undefined;
		};
		if (thing === undefined) {
			logger.warn(`Failed to import command ${path.join(...parts)}, no default export`);
		}
		return thing;
	}

	/**
	 * Import a file as a CommandRegistryItem.
	 * @param parts Path parts to the file, do not include the file extension
	 * @returns The CommandRegistryItem
	 */
	public async importAsCommand(...parts: string[]) {
		const command = await this.importFile<Command | undefined>(...parts);
		if (!command) return;
		return { ...command, subcommandGroups: new Collection(), subcommands: new Collection() } as CommandRegistryItem;
	}

	public override async loadFromDirectory() {
		for (const entry of await readdir(commands``, { withFileTypes: true })) {
			if (entry.name.endsWith("map")) continue;
			const importName = path.basename(entry.name, path.extname(entry.name));
			const isDir = entry.isDirectory();
			if (isDir && existsSync(commands`${entry.name}/index.${IS_BUILT ? "js" : "ts"}`))
				await this.importSecondLevel(importName);
			else if ((!isDir && entry.name.endsWith("ts")) || entry.name.endsWith("js")) {
				const command = await this.importAsCommand(importName);

				if (command) this.set(importName, command);
			}
		}
	}
	/**
	 * Imports a second level command, ie a command with subcommands and/or subcommandGroups.
	 * @param commandName The command name to import, this is the name of the command's folder
	 */
	public async importSecondLevel(commandName: string) {
		const command = await this.importAsCommand(commandName, "index");
		if (!command) return;
		for (const entry of await readdir(commands`${commandName}`, {
			withFileTypes: true,
		})) {
			if (entry.name.endsWith("map")) continue;
			const importName = path.basename(entry.name, path.extname(entry.name));
			if (entry.isDirectory()) await this.importSubcommandGroup(commandName, importName, command);
			if (importName === "index") continue;
			if (entry.name.endsWith("ts") || entry.name.endsWith("js")) {
				const subcommand = await this.importSubcommand(commandName, importName);
				if (!subcommand) return;
				command.subcommands.set(importName, subcommand);
			}
		}
		this.set(commandName, command);
	}

	public async importSubcommandGroup(commandName: string, subcommandGroupName: string, command: CommandRegistryItem) {
		const subcommandGroupDataFn = await this.importFile<SubcommandGroup>(commandName, subcommandGroupName, "index");
		if (!subcommandGroupDataFn) return;
		const subcommandGroup: CommandRegistrySubcommandGroup = {
			data: subcommandGroupDataFn,
			subcommands: new Collection(),
		};
		for (const filename of await readdir(commands`${commandName}/${subcommandGroupName}`)) {
			if (filename.endsWith("map")) continue;
			const importName = path.basename(filename, path.extname(filename));
			if (importName === "index") continue;
			if (filename.endsWith("ts") || filename.endsWith("js")) {
				const subcommand = await this.importSubcommand(commandName, subcommandGroupName, importName);
				if (!subcommand) return;
				subcommandGroup.subcommands.set(importName, subcommand);
			}
		}
		command.subcommandGroups.set(subcommandGroupName, subcommandGroup);
	}

	private async importSubcommand(...parts: string[]) {
		const subcommand = await this.importFile<Subcommand | undefined>(...parts);
		if (subcommand === undefined) return;
		return subcommand;
	}
}
