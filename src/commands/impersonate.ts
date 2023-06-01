import { ChannelType } from "discord.js";
import type Command from "../command.js";
import { impersonate } from "../utils.js";

export default {
	data: (b) =>
		b
			.setDescription("Sends a message as someone else.")
			.addUserOption((b) => b.setName("user").setDescription("The user to impersonate.").setRequired(true))
			.addStringOption((b) =>
				b.setName("content").setDescription("The content of the message.").setRequired(true),
			),
	ownerOnly: true,
	async execute({ interaction, client }) {
		if (!interaction.channel || interaction.channel.type !== ChannelType.GuildText)
			return await interaction.reply({ content: "This command can't be run here.", ephemeral: false });
		const user = interaction.options.getUser("user", true);
		const member = interaction.guild?.members.resolve(user) ?? user;
		await impersonate(client, member, interaction.channel, interaction.options.getString("content", true));
		await interaction.reply({ content: "✅", ephemeral: true });
	},
} as Command;
