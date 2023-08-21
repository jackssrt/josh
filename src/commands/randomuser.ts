import { userMention } from "discord.js";
import { getRandomValues } from "../utils.js";
import createCommand from "./../command.js";

export default createCommand({
	data(b) {
		b.setDescription("Picks a random user for you");
		new Array(25).fill(false).map((_, i) =>
			b.addUserOption((b) =>
				b
					.setName(`user${i + 1 === 1 ? "" : i + 1}`)
					.setRequired(i < 2)
					.setDescription(`User number ${i + 1}`),
			),
		);
		return b;
	},
	async execute({ interaction }) {
		const users = new Array(25)
			.fill(false)
			.flatMap((_, i) => interaction.options.getUser(`user${i + 1 === 1 ? "" : i + 1}`, i < 2) ?? []);
		await interaction.reply(`Your random user is: ${userMention(getRandomValues(users, 1)[0]!.id)}`);
	},
});
