import { userMention } from "discord.js";
import { fillArray, getRandomValues } from "../utils/array.js";
import createCommand from "./../commandHandler/command.js";

export default createCommand({
	data: (b) => {
		b.setDescription("Picks a random user for you");
		for (let i = 0; i < 25; i++) {
			b.addUserOption((b) =>
				b
					.setName(`user${i + 1 === 1 ? "" : i + 1}`)
					.setRequired(i < 2)
					.setDescription(`User number ${i + 1}`),
			);
		}
		return b;
	},
	async execute({ interaction }) {
		const users = fillArray(
			25,
			(i) => interaction.options.getUser(`user${i + 1 === 1 ? "" : i + 1}`, i < 2) ?? [],
		).flat();
		await interaction.reply(`Your random user is: ${userMention(getRandomValues(users, 1)[0]!.id)}`);
	},
});
