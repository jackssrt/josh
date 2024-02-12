import { AttachmentBuilder } from "discord.js";
import { inspect } from "node:util";
import createContextMenuItem from "./../commandHandler/contextMenuItem.js";

export default createContextMenuItem({
	type: "Message",
	data: (b) => b,
	ownerOnly: true,
	async execute({ interaction }) {
		await interaction.reply({
			files: [
				new AttachmentBuilder(Buffer.from(inspect(interaction.targetMessage, false, null, false))).setName(
					"messageData.txt",
				),
			],
			ephemeral: true,
		});
	},
});
