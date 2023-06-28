import { MessageType } from "discord.js";
import type { ContextMenuItem } from "../contextMenuItem.js";
import { sendWelcomeMessage } from "../events/welcomeMessage.js";

export default {
	type: "Message",
	data: (b) => b,
	ownerOnly: true,
	execute: async ({ client, interaction }) => {
		if (!interaction.inCachedGuild() || interaction.targetMessage.type !== MessageType.UserJoin)
			return await interaction.reply({
				content: "Run this context menu item on a join message!",
				ephemeral: true,
			});
		await sendWelcomeMessage(client, interaction.targetMessage);
		await interaction.reply({ content: "done", ephemeral: true });
	},
} as ContextMenuItem<"Message">;
