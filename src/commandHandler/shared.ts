import type {
	AutocompleteInteraction,
	Awaitable,
	ChatInputCommandInteraction,
	SlashCommandBuilder,
	SlashCommandSubcommandBuilder,
	Snowflake,
} from "discord.js";
import type Client from "../client.js";
import type { If } from "../utils/types.js";
import type { DeferType, DeferredInteraction, GuildOnlyChatCommandInteraction } from "./command.js";

export type RemoveSubcommandsFromBuilder<T extends { toJSON: object }, Builder extends { toJSON: object } = T> = {
	[K in keyof T]: T[K] extends (...args: infer A) => infer R ? (R extends Builder ? (...args: A) => T : T[K]) : T[K];
};

export type DataFunction<T extends { toJSON: object }, Builder extends { toJSON: object } = T> = (
	b: RemoveSubcommandsFromBuilder<T, Builder>,
) => RemoveSubcommandsFromBuilder<T, Builder>;
export type ExecuteParam<Deferred extends DeferType, GuildOnly extends boolean> = {
	client: Client<true>;
	interaction: Deferred extends null
		? If<GuildOnly, GuildOnlyChatCommandInteraction, ChatInputCommandInteraction>
		: DeferredInteraction<GuildOnly extends true ? GuildOnlyChatCommandInteraction : ChatInputCommandInteraction>;
};
export type ExecuteFunction<Deferred extends DeferType, GuildOnly extends boolean> = (
	param: ExecuteParam<Deferred, GuildOnly>,
) => Awaitable<unknown>;

export type AutocompleteParam = { client: Client<true>; interaction: AutocompleteInteraction };

export type BaseCommand<
	Builder extends SlashCommandBuilder | SlashCommandSubcommandBuilder,
	Deferred extends DeferType,
	GuildOnly extends boolean,
> = {
	data: DataFunction<Omit<Builder, "addSubcommand" | "addSubcommandGroup">, Builder>;
	defer?: Deferred;
	ownerOnly?: boolean;
	userAllowList?: Snowflake[];
	aliases?: string[];
	guildOnly?: GuildOnly;
	autocomplete?: (param: AutocompleteParam) => Awaitable<unknown>;
	execute: ExecuteFunction<Deferred, GuildOnly>;
};
