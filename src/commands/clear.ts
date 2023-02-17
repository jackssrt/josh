import { PermissionFlagsBits } from "discord.js";
import type Command from "../command";

export default {
	data: (b) =>
		b
			.setDescription("Clears X recent messages in this channel.")
			.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
			.addIntegerOption((b) =>
				b
					.setName("x")
					.setDescription("The number of messages to delete.")
					.setMinValue(1)
					.setMaxValue(100)
					.setRequired(true),
			)
			.setDMPermission(false),
	async execute({ interaction }) {
		if (!interaction.channel || interaction.channel.isDMBased() || interaction.channel.isVoiceBased())
			return await interaction.reply({
				content: "This command can't be used in a dm or voice channel",
				ephemeral: true,
			});
		const num = interaction.options.getInteger("x", true);
		if (!num) return await interaction.reply({ content: "You need to pass in a number!", ephemeral: true });
		if (num > 1) {
			await interaction.channel.bulkDelete(num);
			return await interaction.reply({ content: "✅", ephemeral: true });
		}
		const msg = (await interaction.channel.messages.fetch({ limit: 1 })).first();
		if (!msg) return await interaction.reply({ content: "No messages in channel.", ephemeral: true });
		await interaction.channel.messages.delete(msg);
		await interaction.reply({ content: "✅", ephemeral: true });
	},
} as Command;
