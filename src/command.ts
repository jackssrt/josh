import type {
	AutocompleteInteraction,
	Awaitable,
	ChatInputCommandInteraction,
	Interaction,
	SharedNameAndDescription,
	SlashCommandBuilder,
	Snowflake,
} from "discord.js";
import type Client from "./client.js";

export type Deferred<T extends Interaction> = Omit<T, "reply" | "deferReply">;

export interface Command<Defer extends "ephemeral" | "standard" | null = null, GuildOnly extends boolean = boolean> {
	data: (builder: SlashCommandBuilder) => SharedNameAndDescription & { toJSON: () => object };
	defer?: Defer;
	ownerOnly?: boolean;
	userAllowList?: Snowflake[];
	aliases?: string[];
	guildOnly?: GuildOnly;
	autocomplete?: (param: { client: Client<true>; interaction: AutocompleteInteraction }) => Awaitable<unknown>;
	execute: (param: {
		client: Client<true>;
		interaction: Defer extends null ? ChatInputCommandInteraction : Deferred<ChatInputCommandInteraction>;
	}) => Awaitable<unknown>;
}
/**
 * An identity function to make typescript supply the type argument automatically.
 * @param command Command
 * @returns Command
 */
export default function createCommand<GuildOnly extends boolean, Defer extends "ephemeral" | "standard" | null = null>(
	command: Command<Defer, GuildOnly>,
): Command<Defer, GuildOnly> {
	return command;
}
