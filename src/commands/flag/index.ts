import createCommand from "@/commandHandler/command.js";
import { DEFAULT_FLAGS } from "@/database.js";
import { codeBlock, type APIApplicationCommandOptionChoice, type SlashCommandStringOption } from "discord.js";

export function displayFlag(flag: string, value: string) {
	return codeBlock(`${flag} = ${value}`);
}

export function addFlagOption(b: SlashCommandStringOption) {
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
	data: (b) => b.setDescription("Gets or sets flags"),
	ownerOnly: true,
});
