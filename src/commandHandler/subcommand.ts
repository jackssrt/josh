import type { SlashCommandSubcommandBuilder } from "discord.js";
import type { DeferType } from "./command.js";
import type { BaseCommand } from "./shared.js";

export type Subcommand<Deferred extends DeferType = DeferType, GuildOnly extends boolean = boolean> = BaseCommand<
	SlashCommandSubcommandBuilder,
	Deferred,
	GuildOnly
>;

/**
 * An identity function to make typescript supply the type arguments automatically.
 * @param subcommand Subcommand
 * @returns Subcommand
 */
export default function createSubcommand<Deferred extends DeferType = null, GuildOnly extends boolean = false>(
	subcommand: Subcommand<Deferred, GuildOnly>,
): Subcommand<Deferred, GuildOnly> {
	return subcommand;
}
