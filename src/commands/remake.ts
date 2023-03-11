import { PermissionsBitField } from "discord.js";
import type Command from "../command";
import { fetchRotations, sendRegularRotations, sendSalmonRunRotation } from "../events/rotationNotifier.js";
import { errorEmbeds } from "../utils.js";

type Subcommand = "splatfest" | "mapsandmodesrotation";

export default {
	data: (b) =>
		b
			.addSubcommand((b) => b.setName("splatfest").setDescription("splatfest"))
			.addSubcommand((b) => b.setName("mapsandmodesrotation").setDescription("maps and modes rotation"))
			.addSubcommand((b) => b.setName("salmonrunrotation").setDescription("salmon run rotation"))
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
		} else if (subcommand === "mapsandmodesrotation" || subcommand === "salmonrunrotation") {
			const data = await fetchRotations();
			if (!data)
				return await interaction.editReply(
					await errorEmbeds({ title: "failed to fetch rotations", description: "failed to send api call" }),
				);
			if (subcommand === "mapsandmodesrotation")
				await sendRegularRotations(client, data.endTime, data.turfWar, data.ranked, data.xBattle);
			else await sendSalmonRunRotation(client, data.salmonStartTime, data.salmonEndTime, data.salmon);
		} else {
			return await interaction.editReply({ content: "unimplemented" });
		}
		await interaction.editReply({ content: "done" });
	},
} as Command;
