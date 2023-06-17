import type { APIApplicationCommandOptionChoice } from "discord.js";
import { codeBlock } from "discord.js";
import type Command from "../command.js";
import type { FeatureFlag } from "../database.js";
import database, { FEATURE_FLAGS } from "../database.js";

export default {
	data: (b) =>
		b
			.setDescription("Gets or sets feature flags")
			.addSubcommand((b) =>
				b
					.setName("get")
					.setDescription("Gets a feature flag")
					.addStringOption((b) =>
						b
							.setName("flag")
							.setDescription("The flag to get")
							.setRequired(true)
							.addChoices(
								...Object.keys(FEATURE_FLAGS).map<APIApplicationCommandOptionChoice<string>>((v) => ({
									name: v,
									value: v,
								})),
							),
					),
			)
			.addSubcommand((b) =>
				b
					.setName("set")
					.setDescription("Sets a feature flag")
					.addStringOption((b) =>
						b
							.setName("flag")
							.setDescription("The flag to set")
							.setRequired(true)
							.addChoices(
								...Object.keys(FEATURE_FLAGS).map<APIApplicationCommandOptionChoice<string>>((v) => ({
									name: v,
									value: v,
								})),
							),
					)
					.addStringOption((b) =>
						b.setName("value").setDescription("The value to set the flag to").setRequired(true),
					),
			),
	ownerOnly: true,
	async execute({ interaction }) {
		const flag = interaction.options.getString("flag", true) as FeatureFlag;
		if (interaction.options.getSubcommand(true) === "get") {
			await interaction.reply(codeBlock(await database.getFeatureFlag(flag)));
		} else {
			await database.setFeatureFlag(flag, interaction.options.getString("value", true));
			await interaction.reply(`✅`);
		}
	},
} as Command;
