import { AttachmentBuilder } from "discord.js";
import { inspect } from "node:util";
import type { ContextMenuItem } from "../contextMenuItem.js";

export default {
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
} as ContextMenuItem<"Message">;
