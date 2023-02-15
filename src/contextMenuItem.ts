import type {
	Awaitable,
	ContextMenuCommandBuilder,
	MessageContextMenuCommandInteraction,
	UserContextMenuCommandInteraction,
} from "discord.js";
import type { Client } from "./client.js";

export interface ContextMenuItem<K extends "User" | "Message"> {
	data(builder: ContextMenuCommandBuilder): ContextMenuCommandBuilder;
	execute(param: {
		client: Client<true>;
		interaction: K extends "User" ? UserContextMenuCommandInteraction : MessageContextMenuCommandInteraction;
	}): Awaitable<void>;
	type: K;
}
