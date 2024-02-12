import createSubcommand from "@/commandHandler/subcommand.js";
import database, { type Flag } from "@/database.js";
import { addFlagOption, displayFlag } from "./index.js";

export default createSubcommand({
	data: (b) =>
		b
			.setDescription("Sets a flag")
			.addStringOption(addFlagOption)
			.addStringOption((b) =>
				b.setName("value").setDescription("The value to set the flag to").setRequired(true),
			),
	async execute({ interaction }) {
		const flag = interaction.options.getString("flag", true) as Flag;

		const oldValue = await database.getFlag(flag);
		const newValue = interaction.options.getString("value", true);
		await database.setFlag(flag, newValue);
		await interaction.reply(`${displayFlag(flag, oldValue)}->${displayFlag(flag, newValue)}`);
	},
});
