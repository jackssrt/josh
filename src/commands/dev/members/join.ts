import createSubcommand from "@/commandHandler/subcommand.js";
import { onMemberJoin } from "@/events/joinLeave.js";
import { GuildMember } from "discord.js";
import { finish } from "../index.js";

export default createSubcommand({
	data: (b) =>
		b
			.setDescription("Rerun member join")
			.addUserOption((b) => b.setName("member").setDescription("member").setRequired(true)),
	defer: "ephemeral",
	async execute({ client, interaction }) {
		const member = interaction.options.getMember("member");

		if (
			!(member instanceof GuildMember) ||
			member.user.bot ||
			member.guild !== client.guild ||
			process.env.JOIN_IGNORE_IDS.split(",").includes(member.id)
		)
			return;
		await onMemberJoin(client, member);
		await finish(interaction);
	},
});
