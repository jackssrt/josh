import createSubcommand from "@/commandHandler/subcommand.js";
import database, { type Flag } from "@/database.js";
import { inlineCode } from "discord.js";
import { addFlagOption } from "./index.js";

export default createSubcommand({
	data: (b) => b.setDescription("Clears a flag").addStringOption(addFlagOption),
	async execute({ interaction }) {
		const flag = interaction.options.getString("flag", true) as Flag;
		await database.setFlag(flag, "");
		await interaction.reply(`${inlineCode(flag)} cleared`);
	},
});
