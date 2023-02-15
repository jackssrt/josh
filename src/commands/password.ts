import { randomInt } from "crypto";
import type Command from "../command.js";

export default {
	data: (b) => b.setDescription("Generates a random 4 digit lobby password"),
	async execute({ interaction }) {
		await interaction.reply(`Your random password is: ${randomInt(1111, 9999)}`);
	},
} as Command;
