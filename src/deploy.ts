import consola from "consola";
import { ApplicationCommandType, ContextMenuCommandBuilder, REST, Routes, SlashCommandBuilder } from "discord.js";
import { Client } from "./client.js";
export async function deploy(guildId: string) {
	const client = new Client();
	await client.load();
	const commands = client.commandRegistry.map((command, key) =>
		command.data(new SlashCommandBuilder().setName(key)).toJSON(),
	);
	const contexts = client.contextMenuItemsRegistry.map((item, key) =>
		item
			.data(
				new ContextMenuCommandBuilder()
					.setType(item.type === "User" ? ApplicationCommandType.User : ApplicationCommandType.Message)
					.setName(key),
			)
			.toJSON(),
	);
	const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

	rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId), { body: [...commands, ...contexts] })
		.then((data) => {
			if (Array.isArray(data)) consola.success(`Successfully registered ${data.length} application commands.`);
		})
		.catch((...params: unknown[]) => consola.error(params.shift(), ...params));
}
await deploy(process.env.GUILD_ID);
