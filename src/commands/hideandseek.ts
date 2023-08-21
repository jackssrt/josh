import { randomInt } from "node:crypto";
import createCommand from "./../command.js";
import Game from "./hideandseek/Game.js";

export default createCommand({
	data: (b) =>
		b
			.setDescription("Starts a hide and seek game!")
			.addStringOption((b) =>
				b
					.addChoices({ name: "turfwar", value: "turfwar" }, { name: "ranked", value: "ranked" })
					.setDescription("What mode will this game be in?")
					.setName("mode")
					.setRequired(true),
			)
			.addStringOption((b) =>
				b
					.setName("passcode")
					.setMinLength(4)
					.setMaxLength(4)
					.setRequired(false)
					.setDescription("The passcode set for the room"),
			)
			.addIntegerOption((b) =>
				b
					.setName("maxplayers")
					.setMinValue(2)
					.setMaxValue(8)
					.setRequired(false)
					.setDescription("The max number of players for this game"),
			),
	async execute({ interaction }) {
		if (!interaction.inCachedGuild()) return;
		const mode = interaction.options.getString("mode", true) as "ranked" | "turfwar";
		const maxPlayers = interaction.options.getInteger("maxplayers", false);
		const passcode =
			interaction.options.getString("passcode", false) ??
			`${randomInt(0, 9)}${randomInt(0, 9)}${randomInt(0, 9)}${randomInt(0, 9)}`;
		const game = new Game(interaction, mode, maxPlayers ?? 8, passcode);
		await game.start();
	},
});
