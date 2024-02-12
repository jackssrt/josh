import createSubcommand from "@/commandHandler/subcommand.js";
import rotations from "@/rotations/index.js";
import { finish } from "../index.js";

export default createSubcommand({
	data: (b) => b.setDescription("Force fetch new rotations"),
	defer: "ephemeral",
	async execute({ interaction }) {
		await rotations.forceUpdate();
		await finish(interaction);
	},
});
