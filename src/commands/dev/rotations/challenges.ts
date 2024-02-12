import createSubcommand from "@/commandHandler/subcommand.js";
import { makeChallengeEvents } from "@/events/challengeEvent.js";
import { finish } from "../index.js";

export default createSubcommand({
	data: (b) =>
		b
			.setDescription("Rerun challenges")
			.addBooleanOption((b) =>
				b.setName("overridedatabase").setDescription("Override database?").setRequired(false),
			),
	defer: "ephemeral",
	guildOnly: true,
	async execute({ interaction }) {
		await makeChallengeEvents(
			interaction.guild,
			interaction.options.getBoolean("overridedatabase", false) ?? false,
		);
		await finish(interaction);
	},
});
