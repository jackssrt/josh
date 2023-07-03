import type {
	AutocompleteInteraction,
	Awaitable,
	ChatInputCommandInteraction,
	SharedNameAndDescription,
	SlashCommandBuilder,
	Snowflake,
} from "discord.js";
import type Client from "./client.js";

export default interface Command {
	data: (builder: SlashCommandBuilder) => SharedNameAndDescription & { toJSON: () => object };
	defer?: "ephemeral" | "standard";
	ownerOnly?: boolean;
	userAllowList?: Snowflake[];
	aliases?: string[];
	autocomplete?: (param: { client: Client<true>; interaction: AutocompleteInteraction }) => Awaitable<void>;
	execute: (param: { client: Client<true>; interaction: ChatInputCommandInteraction }) => Awaitable<void>;
}
