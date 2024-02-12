import createSubcommand from "@/commandHandler/subcommand.js";
import type { Flag } from "@/database.js";
import database from "@/database.js";
import { addFlagOption, displayFlag } from "./index.js";

export default createSubcommand({
	data: (b) => b.setDescription("Gets a flag").addStringOption(addFlagOption),
	async execute({ interaction }) {
		const flag = interaction.options.getString("flag", true) as Flag;

		await interaction.reply(displayFlag(flag, await database.getFlag(flag)));
	},
});
