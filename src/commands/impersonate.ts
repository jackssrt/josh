import { ChannelType } from "discord.js";
import { impersonate } from "../utils/discord/messages.js";
import createCommand from "./../command.js";

export default createCommand({
	data: (b) =>
		b
			.setDescription("Sends a message as someone else.")
			.addUserOption((b) => b.setName("user").setDescription("The user to impersonate.").setRequired(true))
			.addStringOption((b) =>
				b.setName("content").setDescription("The content of the message.").setRequired(true),
			),
	ownerOnly: true,
	defer: "ephemeral",
	async execute({ interaction, client }) {
		if (!interaction.channel || interaction.channel.type !== ChannelType.GuildText)
			return await interaction.editReply("This command can't be run here.");
		const user = interaction.options.getUser("user", true);
		const member = interaction.guild?.members.resolve(user) ?? user;
		await impersonate(client, member, interaction.channel, interaction.options.getString("content", true));
		await interaction.deleteReply();
	},
});
