import type { Awaitable, ChatInputCommandInteraction, SharedNameAndDescription, SlashCommandBuilder } from "discord.js";
import type Client from "./client.js";

export default interface Command {
	data(builder: SlashCommandBuilder): SharedNameAndDescription & { toJSON(): object };
	defer?: "ephemeral" | "standard";
	execute(param: { client: Client<true>; interaction: ChatInputCommandInteraction }): Awaitable<void>;
}
