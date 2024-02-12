import type { ChatInputCommandInteraction, Interaction, SlashCommandBuilder } from "discord.js";
import type { Opaque, SetOptional } from "type-fest";
import type { BaseCommand } from "./shared.js";

export type DeferredInteraction<T extends Interaction> = Opaque<Omit<T, "reply" | "deferReply">>;
export type GuildOnlyChatCommandInteraction = ChatInputCommandInteraction<"cached">;

export type DeferType = "ephemeral" | "standard" | null;

export type Command<Deferred extends DeferType = DeferType, GuildOnly extends boolean = boolean> = SetOptional<
	BaseCommand<SlashCommandBuilder, Deferred, GuildOnly>,
	"execute"
>;

/**
 * An identity function to make typescript supply the type arguments automatically.
 * @param command Command
 * @returns Command
 */
export default function createCommand<Defer extends DeferType = null, GuildOnly extends boolean = false>(
	command: Command<Defer, GuildOnly>,
): Command<Defer, GuildOnly> {
	return command;
}
