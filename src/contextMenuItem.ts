import type {
	Awaitable,
	ContextMenuCommandBuilder,
	MessageContextMenuCommandInteraction,
	UserContextMenuCommandInteraction,
} from "discord.js";
import type Client from "./client.js";

export interface ContextMenuItem<T extends "User" | "Message"> {
	type: T;
	ownerOnly?: boolean;
	data(builder: ContextMenuCommandBuilder): ContextMenuCommandBuilder;
	execute(param: {
		client: Client<true>;
		interaction: T extends "User" ? UserContextMenuCommandInteraction : MessageContextMenuCommandInteraction;
	}): Awaitable<void>;
}
