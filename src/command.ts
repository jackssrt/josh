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
export type GuildOnly = ChatInputCommandInteraction<"cached" | "raw">;

export type DeferType = "ephemeral" | "standard" | null;

export type Command<D extends DeferType = null, G extends boolean = boolean> = {
	data: (builder: SlashCommandBuilder) => SharedNameAndDescription & { toJSON: () => object };
	defer?: D;
	ownerOnly?: boolean;
	userAllowList?: Snowflake[];
	aliases?: string[];
	guildOnly?: G;
	autocomplete?: (param: { client: Client<true>; interaction: AutocompleteInteraction }) => Awaitable<unknown>;
	execute: (param: {
		client: Client<true>;
		interaction: D extends null
			? G extends true
				? GuildOnly
				: ChatInputCommandInteraction
			: Deferred<G extends true ? GuildOnly : ChatInputCommandInteraction>;
	}) => Awaitable<unknown>;
};
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
