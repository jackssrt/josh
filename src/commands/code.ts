import { randomInt } from "crypto";
import type Command from "../command.js";

export default {
	data: (b) =>
		b
			.setDescription("Generates a random 4 digit room join code")
			.addBooleanOption((b) =>
				b.setName("hidden").setDescription("Should your code be only shown to you?").setRequired(false),
			),
	async execute({ interaction }) {
		await interaction.reply({
			content: `Your random join code is: \`${randomInt(0, 9)}${randomInt(0, 9)}${randomInt(0, 9)}${randomInt(
				0,
				9,
			)}\``,
			ephemeral: interaction.options.getBoolean("hidden", false) ?? false,
		});
	},
} as Command;
