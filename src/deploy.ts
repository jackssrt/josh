import {
	ApplicationCommandType,
	ContextMenuCommandBuilder,
	PermissionFlagsBits,
	REST,
	Routes,
	SlashCommandBuilder,
} from "discord.js";
import * as dotenv from "dotenv";
import Client from "./client.js";
import logger from "./logger.js";
dotenv.config();
export async function deploy(guildId: string) {
	const client = new Client();
	await client.load();
	const commands = client.commandRegistry.map((command, key) =>
		command
			.data(
				new SlashCommandBuilder()
					.setName(key)
					.setDescription("This command does something...")
					.setDefaultMemberPermissions(command.ownerOnly ? PermissionFlagsBits.Administrator : undefined),
			)
			.toJSON(),
	);
	const contexts = client.contextMenuItemsRegistry.map((item, key) =>
		item
			.data(
				new ContextMenuCommandBuilder()
					.setType(item.type === "User" ? ApplicationCommandType.User : ApplicationCommandType.Message)
					.setName(key)
					.setDefaultMemberPermissions(item.ownerOnly ? PermissionFlagsBits.Administrator : undefined),
			)
			.toJSON(),
	);
	const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

	await rest
		.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId), { body: [...commands, ...contexts] })
		.then((data) => {
			if (Array.isArray(data)) logger.info(`Successfully registered ${data.length} application commands.`);
		})
		.catch((...params: unknown[]) => logger.error(params));
	process.exit();
}
await deploy(process.env.GUILD_ID);
