import type Command from "../command.js";
import Game from "./hideandseek/Game.js";

export default {
	data: (b) =>
		b
			.setDescription("Starts a hide and seek game!")
			.addStringOption((b) =>
				b
					.addChoices({ name: "turfwar", value: "turfwar" }, { name: "ranked", value: "ranked" })
					.setDescription("What mode will this game be in?")
					.setName("mode")
					.setRequired(true),
			),
	async execute({ interaction }) {
		const mode = interaction.options.getString("mode", true) as "ranked" | "turfwar";
		const game = new Game(interaction, mode, 8);
		await game.start();
	},
} as Command;
