import createSubcommand from "@/commandHandler/subcommand.js";
import { parallel } from "@/utils/promise.js";
import { finish } from "./index.js";

export default createSubcommand({
	data: (b) => b.setDescription("Cancel all events"),
	defer: "ephemeral",
	guildOnly: true,
	async execute({ interaction }) {
		await parallel(interaction.guild.scheduledEvents.cache.map((v) => interaction.guild.scheduledEvents.delete(v)));
		await finish(interaction);
	},
});
