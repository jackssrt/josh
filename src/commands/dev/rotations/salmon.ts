import createSubcommand from "@/commandHandler/subcommand.js";
import rotations from "@/rotations/index.js";
import { finish } from "../index.js";

export default createSubcommand({
	data: (b) => b.setDescription("Rerun salmon run rotation"),
	defer: "ephemeral",
	async execute({ interaction }) {
		await rotations.notifySalmonChanged();
		await finish(interaction);
	},
});
