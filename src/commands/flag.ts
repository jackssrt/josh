import type { APIApplicationCommandOptionChoice, APIEmbedField, SlashCommandStringOption } from "discord.js";
import { codeBlock, inlineCode } from "discord.js";
import type { Flag } from "../database.js";
import database, { DEFAULT_FLAGS } from "../database.js";
import { embeds } from "../utils.js";
import createCommand from "./../command.js";

function displayFlag(flag: string, value: string) {
	return codeBlock(`${flag} = ${value}`);
}

type Subcommand = "get" | "getall" | "set";

function addFlagOption(b: SlashCommandStringOption) {
	return b
		.setName("flag")
		.setDescription("The flag to get")
		.setRequired(true)
		.addChoices(
			...Object.keys(DEFAULT_FLAGS).map<APIApplicationCommandOptionChoice<string>>((v) => ({
				name: v,
				value: v,
			})),
		);
}

export default createCommand({
	data: (b) =>
		b
			.setDescription("Gets or sets feature flags")
			.addSubcommand((b) => b.setName("get").setDescription("Gets a feature flag").addStringOption(addFlagOption))
			.addSubcommand((b) => b.setName("getall").setDescription("Gets all flags"))
			.addSubcommand((b) =>
				b
					.setName("set")
					.setDescription("Sets a feature flag")
					.addStringOption(addFlagOption)
					.addStringOption((b) =>
						b.setName("value").setDescription("The value to set the flag to").setRequired(true),
					),
			),
	ownerOnly: true,
	async execute({ interaction }) {
		const subcommand = interaction.options.getSubcommand(true) as Subcommand;
		if (subcommand === "get") {
			const flag = interaction.options.getString("flag", true) as Flag;

			await interaction.reply(displayFlag(flag, await database.getFlag(flag)));
		} else if (subcommand === "getall") {
			const flagOverrides = await database.getAllFlags();
			const flagsWithDefaultValues = (Object.entries(DEFAULT_FLAGS) as [Flag, string][]).filter(
				([k]) => flagOverrides[k] === undefined,
			);
			if (Object.keys(flagOverrides).length + flagsWithDefaultValues.length > 25)
				throw new Error("Flag overrides exceed 25, implement pagination for getall");
			await interaction.reply(
				await embeds((b) =>
					b.addFields(
						...Object.entries(flagOverrides).map<APIEmbedField>(([k, v]) => ({
							name: k,
							value: inlineCode(v),
							inline: true,
						})),
						...flagsWithDefaultValues.map<APIEmbedField>(([k, v]) => ({
							name: k,
							value: `${inlineCode(v)} [DEFAULT]`,
							inline: true,
						})),
					),
				),
			);
		} else {
			const flag = interaction.options.getString("flag", true) as Flag;

			const oldValue = await database.getFlag(flag);
			const newValue = interaction.options.getString("value", true);
			await database.setFlag(flag, newValue);
			await interaction.reply(`${displayFlag(flag, oldValue)}->${displayFlag(flag, newValue)}`);
		}
	},
});
