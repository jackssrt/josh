import { PermissionFlagsBits } from "discord.js";
import createCommand from "./../command.js";

export default createCommand({
	data: (b) =>
		b
			.setDescription("Delete the X latest message(s) in this channel.")
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
		if (num > 1) {
			// delete multiple messages
			// the reply is first here to prevent an unknown interaction error
			// idk why
			await interaction.reply({ content: "✅", ephemeral: true });
			await interaction.channel.bulkDelete(num);
		} else {
			// delete latest message
			const msg = (await interaction.channel.messages.fetch({ limit: 1 })).first();
			if (!msg) return await interaction.reply({ content: "No messages in channel.", ephemeral: true });
			await interaction.channel.messages.delete(msg);
			await interaction.reply({ content: "✅", ephemeral: true });
		}
	},
});
