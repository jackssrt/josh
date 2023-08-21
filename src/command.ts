import type {
	AutocompleteInteraction,
	Awaitable,
	ChatInputCommandInteraction,
	SharedNameAndDescription,
	SlashCommandBuilder,
	Snowflake,
} from "discord.js";
import type Client from "./client.js";

export interface Command<GuildOnly extends boolean = boolean> {
	data: (builder: SlashCommandBuilder) => SharedNameAndDescription & { toJSON: () => object };
	defer?: "ephemeral" | "standard";
	ownerOnly?: boolean;
	userAllowList?: Snowflake[];
	aliases?: string[];
	guildOnly?: GuildOnly;
	autocomplete?: (param: { client: Client<true>; interaction: AutocompleteInteraction }) => Awaitable<unknown>;
	execute: (param: { client: Client<true>; interaction: ChatInputCommandInteraction }) => Awaitable<unknown>;
}
/**
 * An identity function to make typescript supply the type argument automatically.
 * @param command Command
 * @returns Command
 */
export default function createCommand<GuildOnly extends boolean>(command: Command<GuildOnly>): Command<GuildOnly> {
	return command;
}
