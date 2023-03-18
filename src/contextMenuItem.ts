import type {
	Awaitable,
	ContextMenuCommandBuilder,
	MessageContextMenuCommandInteraction,
	UserContextMenuCommandInteraction,
} from "discord.js";
import type Client from "./client.js";

export interface ContextMenuItem<K extends "User" | "Message"> {
	type: K;
	ownerOnly?: boolean;
	data(builder: ContextMenuCommandBuilder): ContextMenuCommandBuilder;
	execute(param: {
		client: Client<true>;
		interaction: K extends "User" ? UserContextMenuCommandInteraction : MessageContextMenuCommandInteraction;
	}): Awaitable<void>;
}
