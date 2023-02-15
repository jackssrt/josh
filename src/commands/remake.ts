import { PermissionsBitField } from "discord.js";
import type Command from "../command";

export default {
	data: (b) =>
		b
			.setDescription("Forcefully reruns certain automatic stuff.")
			.setDMPermission(false)
			.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
			.addSubcommand((b) => b.setName("splatfest").setDescription("splatfest")),
	execute: ({ interaction }) => {
		if (interaction.user.id === "304603833248514048")
			return interaction.reply({ content: "This command can only be run by the developer!", ephemeral: true });
		const subcommand = interaction.options.getSubcommand();
		if (subcommand === "splatfest") {
			//pass
		}
	},
} as Command;
