import { MessageType } from "discord.js";
import { sendWelcomeMessage } from "../events/welcomeMessage.js";
import createContextMenuItem from "./../contextMenuItem.js";

export default createContextMenuItem({
	type: "Message",
	data: (b) => b,
	ownerOnly: true,
	execute: async ({ interaction }) => {
		if (!interaction.inCachedGuild() || interaction.targetMessage.type !== MessageType.UserJoin)
			return await interaction.reply({
				content: "Run this context menu item on a join message!",
				ephemeral: true,
			});
		await sendWelcomeMessage(interaction.targetMessage);
		await interaction.reply({ content: "done", ephemeral: true });
	},
});
