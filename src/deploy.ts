import {
	ApplicationCommandType,
	ContextMenuCommandBuilder,
	PermissionFlagsBits,
	REST,
	Routes,
	SlashCommandBuilder,
	type SlashCommandSubcommandBuilder,
} from "discord.js";
import * as dotenv from "dotenv";
import { startCase } from "lodash-es";
import Client from "./client.js";
import logger from "./utils/Logger.js";
import { pluralize } from "./utils/string.js";
dotenv.config();
export async function deploy(guildId: string) {
	const client = (await Client.new()) as Client<boolean, boolean>;
	await (client as Client).load();
	const commands = client.commandRegistry.map((command, key) => {
		// Register command
		const b = new SlashCommandBuilder()
			.setName(key)
			.setDescription("This command does something...")
			.setDMPermission(command.guildOnly)
			.setDefaultMemberPermissions(command.ownerOnly ? PermissionFlagsBits.Administrator : undefined);

		// Register subcommands
		command.subcommands.forEach((subcommand, subcommandName) =>
			b.addSubcommand(
				(subcommandBuilder) =>
					subcommand.data(
						subcommandBuilder.setName(subcommandName).setDescription("This subcommand does something..."),
					) as SlashCommandSubcommandBuilder,
			),
		);

		// Register subcommandGroups
		command.subcommandGroups.forEach((subcommandGroup, subcommandGroupName) =>
			b.addSubcommandGroup((subcommandGroupBuilder) => {
				subcommandGroupBuilder = subcommandGroup.data(
					subcommandGroupBuilder
						.setName(subcommandGroupName)
						.setDescription("This subcommand group does something..."),
				);

				// Register subcommands in subcommandGroups
				subcommandGroup.subcommands.forEach((subcommandGroupSubcommand, subcommandGroupSubcommandName) =>
					subcommandGroupBuilder.addSubcommand(
						(subcommandGroupSubcommandBuilder) =>
							subcommandGroupSubcommand.data(
								subcommandGroupSubcommandBuilder
									.setName(subcommandGroupSubcommandName)
									.setDescription("This subcommand does something..."),
							) as SlashCommandSubcommandBuilder,
					),
				);
				return subcommandGroupBuilder;
			}),
		);
		return command.data(b).toJSON();
	});
	const contextMenuItems = client.contextMenuItemsRegistry.map((item, key) =>
		item
			.data(
				new ContextMenuCommandBuilder()
					.setType(item.type === "User" ? ApplicationCommandType.User : ApplicationCommandType.Message)
					.setName(startCase(key))
					.setDefaultMemberPermissions(item.ownerOnly ? PermissionFlagsBits.Administrator : undefined),
			)
			.toJSON(),
	);
	const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

	await rest
		.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId), {
			body: [...commands, ...contextMenuItems],
		})
		.then((data) => {
			if (Array.isArray(data))
				logger.info(`Successfully registered ${data.length} ${pluralize("application command", data.length)}.`);
		})
		.catch((...params: unknown[]) => logger.error(params));
	process.exit();
}
await deploy(process.env.GUILD_ID);
