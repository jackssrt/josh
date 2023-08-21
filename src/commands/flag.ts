import type { APIApplicationCommandOptionChoice } from "discord.js";
import { codeBlock } from "discord.js";
import type { FeatureFlag } from "../database.js";
import database, { FEATURE_FLAGS } from "../database.js";
import createCommand from "./../command.js";

function displayFlag(flag: string, value: string) {
	return codeBlock(`${flag} = ${value}`);
}

export default createCommand({
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
			await interaction.reply(displayFlag(flag, await database.getFeatureFlag(flag)));
		} else {
			const oldValue = await database.getFeatureFlag(flag);
			const newValue = interaction.options.getString("value", true);
			await database.setFeatureFlag(flag, newValue);
			await interaction.reply(`${displayFlag(flag, oldValue)}->${displayFlag(flag, newValue)}`);
		}
	},
});
