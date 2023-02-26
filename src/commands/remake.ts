import { PermissionsBitField } from "discord.js";
import type Command from "../command";
import { sendRotations } from "../events/rotationNotifier.js";

type Subcommand = "splatfest" | "mapsandmodesrotation";

export default {
	data: (b) =>
		b
			.addSubcommand((b) => b.setName("splatfest").setDescription("splatfest"))
			.addSubcommand((b) => b.setName("mapsandmodesrotation").setDescription("maps and modes rotation"))
			.setDescription("Forcefully reruns certain automatic stuff.")
			.setDMPermission(false)
			.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
	execute: async ({ interaction, client }) => {
		if (interaction.user.id !== process.env["OWNER_ID"]!)
			return interaction.reply({ content: "This command can only be run by the developer!", ephemeral: true });
		await interaction.deferReply({ ephemeral: true });
		const subcommand = interaction.options.getSubcommand() as Subcommand;
		if (subcommand === "splatfest") {
			//pass
		} else if (subcommand === "mapsandmodesrotation") {
			await sendRotations(client);
		} else {
			return await interaction.editReply({ content: "unimplemented" });
		}
		await interaction.editReply({ content: "done" });
	},
} as Command;
