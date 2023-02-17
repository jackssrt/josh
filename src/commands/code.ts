import { randomInt } from "crypto";
import type Command from "../command.js";

export default {
	data: (b) => b.setDescription("Generates a random 4 digit room join code"),
	async execute({ interaction }) {
		await interaction.reply(
			`Your random join code is: \`${randomInt(0, 9)}${randomInt(0, 9)}${randomInt(0, 9)}${randomInt(0, 9)}\``,
		);
	},
} as Command;
