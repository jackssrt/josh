import { randomInt } from "crypto";
import createCommand from "./../command.js";

export default createCommand({
	data: (b) =>
		b
			.setDescription("Generates a random 4 digit room join code")
			.addBooleanOption((b) =>
				b.setName("hidden").setDescription("Should the code be only shown to you?").setRequired(false),
			),
	aliases: ["password"],
	async execute({ interaction }) {
		await interaction.reply({
			content: `Your random join code is: \`${randomInt(0, 9)}${randomInt(0, 9)}${randomInt(0, 9)}${randomInt(
				0,
				9,
			)}\``,
			ephemeral: interaction.options.getBoolean("hidden", false) ?? false,
		});
	},
});
