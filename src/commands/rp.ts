import { parallel } from "../utils/promise.js";
import createCommand from "./../command.js";

export default createCommand({
	data: (b) =>
		b
			.setDescription("Roleplay as Josh")
			.addStringOption((b) =>
				b
					.setName("content")
					.setMinLength(0)
					.setMaxLength(2000)
					.setDescription("Content of the message")
					.setRequired(false),
			)
			.addAttachmentOption((b) => b.setName("attachment").setDescription("Attachment").setRequired(false)),
	userAllowList: process.env.ROLEPLAYER_IDS.split(","),
	async execute({ interaction }) {
		if (!interaction.channel) return;
		const content = interaction.options.getString("content");
		const attachment = interaction.options.getAttachment("attachment");
		if (!content && !attachment)
			return interaction.reply({ content: "pass in something to send!", ephemeral: true });

		await parallel(
			interaction.channel.send({ content: content ?? "", files: attachment ? [attachment] : [] }),
			async () => {
				await interaction.reply({ content: "✅", ephemeral: true });
				await interaction.deleteReply();
			},
		);
	},
});
