import createSubcommand from "@/commandHandler/subcommand.js";
import database, { DEFAULT_FLAGS, type Flag } from "@/database.js";
import { embeds } from "@/utils/discord/embeds.js";
import { inlineCode, type APIEmbedField } from "discord.js";

export default createSubcommand({
	data: (b) => b.setDescription("Gets all flags"),
	async execute({ interaction }) {
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
	},
});
