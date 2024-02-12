import createSubcommand from "@/commandHandler/subcommand.js";
import database from "@/database.js";
import { updateStatsMessage } from "@/events/statsMessage.js";
import { userMention } from "discord.js";
import { finish } from "../index.js";

export default createSubcommand({
	data: (b) =>
		b
			.setDescription("Sets who invited someone")
			.addUserOption((b) =>
				b.setName("inviter").setDescription("The person who invited someone").setRequired(true),
			)
			.addUserOption((b) => b.setName("invitee").setDescription("The person who got invited").setRequired(true)),
	defer: "ephemeral",
	async execute({ client, interaction }) {
		const inviter = interaction.options.getUser("inviter", true).id;
		const invitee = interaction.options.getUser("invitee", true).id;
		await database.setInviteRecord(inviter, invitee);
		await updateStatsMessage(client);
		await finish(interaction, `${userMention(inviter)} => ${userMention(invitee)}`);
	},
});
