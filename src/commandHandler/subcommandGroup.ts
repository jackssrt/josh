import type { SlashCommandSubcommandGroupBuilder } from "discord.js";
import type { DataFunction } from "./shared.js";

export type SubcommandGroup = DataFunction<SlashCommandSubcommandGroupBuilder>;

/**
 * An identity function to infer the type of subcommandGroup automatically.
 * @param subcommandGroup The subcommandGroup data function
 * @returns The subcommandGroup data function
 */
export default function createSubcommandGroup(subcommandGroup: SubcommandGroup) {
	return subcommandGroup;
}
