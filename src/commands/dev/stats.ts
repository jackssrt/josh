import createSubcommand from "@/commandHandler/subcommand.js";
import { updateStatsMessage } from "@/events/statsMessage.js";
import { finish } from "./index.js";

export default createSubcommand({
	data: (b) => b.setDescription("Rerun stats"),
	defer: "ephemeral",
	async execute({ client, interaction }) {
		await updateStatsMessage(client);
		await finish(interaction);
	},
});
