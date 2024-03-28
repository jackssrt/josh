import type {
	AutocompleteInteraction,
	CategoryChannel,
	ChatInputCommandInteraction,
	ClientEvents,
	ContextMenuCommandInteraction,
	Guild,
	MessageContextMenuCommandInteraction,
	NewsChannel,
	PresenceData,
	Role,
	TextChannel,
	User,
	UserContextMenuCommandInteraction,
} from "discord.js";
import {
	ActivityType,
	ApplicationCommandOptionType,
	Client as DiscordClient,
	GatewayIntentBits,
	GuildMember,
	inlineCode,
} from "discord.js";
import { startCase } from "lodash-es";
import { spawn } from "node:child_process";
import { platform } from "node:process";
import type { Command } from "./commandHandler/command.js";
import type { ContextMenuItem } from "./commandHandler/contextMenuItem.js";
import type { Event } from "./commandHandler/event.js";
import type { Subcommand } from "./commandHandler/subcommand.js";
import CommandRegistry, { type CommandRegistryItem } from "./commandRegistry.js";
import database from "./database.js";
import { IS_BUILT, IS_DEV } from "./env.js";
import { reportError } from "./errorhandler.js";
import Registry from "./registry.js";
import logger from "./utils/Logger.js";
import OnceSignal from "./utils/OnceSignal.js";
import { startupSound } from "./utils/paths.js";
import { parallel } from "./utils/promise.js";
import { pluralize } from "./utils/string.js";
import { formatTime } from "./utils/time.js";

export const USER_AGENT = "Josh (source code: https://github.com/jackssrt/josh , make an issue if it's misbehaving)";

export default class Client<Ready extends boolean = false, Loaded extends boolean = true> extends DiscordClient<Ready> {
	public static instance: Client<true> | undefined = undefined;
	public commandRegistry = new CommandRegistry();
	public eventRegistry = new Registry<Event<keyof ClientEvents>>();
	public contextMenuItemsRegistry = new Registry<ContextMenuItem<"User" | "Message">>();
	public guild = undefined as Loaded extends true ? Guild : undefined;
	public guildMe = undefined as Loaded extends true ? GuildMember : undefined;
	public owner = undefined as Loaded extends true ? GuildMember : undefined;
	public alt = undefined as Loaded extends true ? User : undefined;
	public voiceCategory = undefined as Loaded extends true ? CategoryChannel : undefined;
	public unusedVoiceCategory = undefined as Loaded extends true ? CategoryChannel : undefined;
	public generalChannel = undefined as Loaded extends true ? TextChannel : undefined;
	public memberRole = undefined as Loaded extends true ? Role : undefined;
	public joinLeaveChannel = undefined as Loaded extends true ? TextChannel : undefined;
	public mapsChannel = undefined as Loaded extends true ? NewsChannel : undefined;
	public salmonRunChannel = undefined as Loaded extends true ? NewsChannel : undefined;
	public colorsRoleCategory = undefined as Loaded extends true ? Role : undefined;
	public statsChannel = undefined as Loaded extends true ? TextChannel : undefined;
	public splatfestTeamRoleCategory = undefined as Loaded extends true ? Role : undefined;
	public announcementsChannel = undefined as Loaded extends true ? NewsChannel : undefined;

	// this is static because of the errorhandler
	public static loadedOnceSignal? = new OnceSignal();
	public static readonly defaultPresence = {
		status: "online",
		activities: [{ type: ActivityType.Competing, name: "Splatoon 3" }],
	} satisfies Readonly<PresenceData>;

	private constructor(presence: PresenceData) {
		super({
			intents: [
				GatewayIntentBits.Guilds,
				GatewayIntentBits.GuildMessages,
				GatewayIntentBits.GuildMembers,
				GatewayIntentBits.DirectMessages,
				GatewayIntentBits.MessageContent,
				GatewayIntentBits.GuildEmojisAndStickers,
				GatewayIntentBits.GuildPresences,
				GatewayIntentBits.GuildVoiceStates,
			],
			presence,
		});
		this.on("debug", async (message) => {
			if (await database.getBooleanFlag("log.discord.debug")) logger.debug(message);
		});
		this.on("warn", async (message) => {
			if (await database.getBooleanFlag("log.discord.warn")) logger.warn(message);
		});
		this.rest.on(
			"response",
			(req, res) =>
				void (async () => {
					if (await database.getBooleanFlag("log.ratelimits"))
						logger.debug(
							"[R]",
							req.method,
							req.route,
							res.headers.get("X-RateLimit-Remaining"),
							"/",
							res.headers.get("X-RateLimit-Limit"),
							`[${res.headers.get("X-RateLimit-Reset-After")}]`,
						);
				})(),
		);
	}

	public static async new(): Promise<Client<false, false>> {
		return new Client((await database.getActivePresence()) ?? Client.defaultPresence);
	}

	public async load(this: Client) {
		const dirName = IS_BUILT ? "build" : "src";
		const start = new Date();

		await parallel(
			this.commandRegistry.loadFromDirectory(),
			this.eventRegistry.loadFromDirectory(`./${dirName}/events`),
			this.contextMenuItemsRegistry.loadFromDirectory(`./${dirName}/contextMenuItems`, startCase),
		);
		logger.info(`Loaded ${this.commandRegistry.size} ${pluralize("command", this.commandRegistry.size)}`);
		for (const v of new Set(this.commandRegistry.values())) {
			if (v.aliases)
				for (const alias of v.aliases) {
					this.commandRegistry.set(alias, v);
				}
		}

		//#region Sanity checks
		/* eslint-disable @typescript-eslint/no-unnecessary-condition */
		function sanityCheckFail(item: string, key: string, reason: string) {
			logger.error(`${key} ${item} failed sanity check, ${reason} not defined`);
		}
		// sanity check commands
		for (const [k, v] of this.commandRegistry.entries()) {
			const fail = sanityCheckFail.bind(this, "command", k);

			if (!v.data) fail("data()");
			// no execute function and no subcommands or subcommandGroups
			if (!v.execute && v.subcommandGroups.size === 0 && v.subcommands.size === 0) fail("execute()");

			// sanity check subcommands
			for (const [k2, v2] of v.subcommands.entries()) {
				const fail = sanityCheckFail.bind(this, "subcommand", `${k} ${k2}`);

				if (!v2.data) fail("data()");
				if (!v2.execute) fail("execute()");
			}

			// sanity check subcommandGroups
			for (const [k2, v2] of v.subcommandGroups.entries()) {
				const fail = sanityCheckFail.bind(this, "subcommandGroup", `${k} ${k2}`);

				if (!v2.data) fail("data()");
				for (const [k3, v3] of v2.subcommands.entries()) {
					const fail = sanityCheckFail.bind(this, "subcommand in subcommandGroup", `${k} ${k2} ${k3}`);

					if (!v3.data) fail("data()");
					if (!v3.execute) fail("execute()");
				}
			}
		}

		// sanity check events
		for (const [k, v] of this.eventRegistry.entries()) {
			const fail = sanityCheckFail.bind(this, "event", k);

			if (!v.event) fail("event");
			if (!v.on) fail("on()");
		}

		// sanity check contextMenuItems
		for (const [k, v] of this.contextMenuItemsRegistry.entries()) {
			const fail = sanityCheckFail.bind(this, "contextMenuItem", k);

			if (!v.data) fail("data()");
			if (!v.execute) fail("execute()");
			if (!v.type) fail("type");
		}
		/* eslint-enable @typescript-eslint/no-unnecessary-condition */
		//#endregion Sanity checks

		const end = new Date();
		logger.info(`Loaded ${this.eventRegistry.size} ${pluralize("event", this.eventRegistry.size)}`);
		logger.info(
			`Loaded ${this.contextMenuItemsRegistry.size} ${pluralize(
				"context menu item",
				this.contextMenuItemsRegistry.size,
			)}`,
		);
		logger.info(`Loading took ${formatTime((end.getTime() - start.getTime()) / 1000)}`);
	}
	public async start(this: Client<true>) {
		this.on("ready", async () => {
			logger.info("Fetching discord objects phase 1...");
			const start = new Date();
			[this.guild, this.alt] = await parallel(
				this.guilds.fetch(process.env.GUILD_ID),
				this.users.fetch(process.env.ALT_USER_ID),
			);
			logger.info("Fetching discord objects phase 2...");
			[
				this.guildMe,
				this.owner,
				this.voiceCategory,
				this.unusedVoiceCategory,
				this.generalChannel,
				this.memberRole,
				this.joinLeaveChannel,
				this.mapsChannel,
				this.salmonRunChannel,
				this.colorsRoleCategory,
				this.statsChannel,
				this.splatfestTeamRoleCategory,
				this.announcementsChannel,
			] = await parallel(
				this.guild.members.fetchMe(),
				this.guild.members.fetch(process.env.OWNER_ID),
				this.guild.channels.fetch(process.env.VOICE_CATEGORY_ID) as Promise<CategoryChannel>,
				this.guild.channels.fetch(process.env.UNUSED_VOICE_CATEGORY_ID) as Promise<CategoryChannel>,
				this.guild.channels.fetch(process.env.GENERAL_CHANNEL_ID) as Promise<TextChannel>,
				this.guild.roles.fetch(process.env.MEMBER_ROLE_ID) as Promise<Role>,
				this.guild.channels.fetch(process.env.JOIN_LEAVE_CHANNEL_ID) as Promise<TextChannel>,
				this.guild.channels.fetch(process.env.MAPS_CHANNEL_ID) as Promise<NewsChannel>,
				this.guild.channels.fetch(process.env.SALMON_RUN_CHANNEL_ID) as Promise<NewsChannel>,
				this.guild.roles.fetch(process.env.COLORS_ROLE_CATEGORY_ID) as Promise<Role>,
				this.guild.channels.fetch(process.env.STATS_CHANNEL_ID) as Promise<TextChannel>,
				this.guild.roles.fetch(process.env.SPLATFEST_TEAM_CATEGORY_ROLE_ID) as Promise<Role>,
				this.guild.channels.fetch(process.env.ANNOUNCEMENTS_CHANNEL_ID) as Promise<NewsChannel>,
			);
			logger.info(`Fetching discord objects took ${formatTime((Date.now() - start.getTime()) / 1000)}`);
			Client.instance = this;
			Client.loadedOnceSignal?.fire();
			delete Client.loadedOnceSignal;
			if (IS_DEV)
				if (platform === "win32")
					spawn(`powershell.exe`, [
						"-c",
						`$player = New-Object System.Media.SoundPlayer;$player.SoundLocation = '${startupSound}';$player.playsync();`,
					]);
				else if (platform === "linux") spawn("aplay", [startupSound]);
			logger.info("Ready!");
		});

		for (const event of this.eventRegistry.values()) {
			this[event.isOnetime ? "once" : "on"](event.event, async (...params: ClientEvents[typeof event.event]) => {
				await Client.loadedOnceSignal;
				if (await database.getBooleanFlag("log.events")) this.logEvent(event);
				await event.on({ client: this }, ...params);
			});
		}
		logger.info(`Hooked ${this.eventRegistry.size} event${this.eventRegistry.size === 1 ? "" : "s"}`);

		this.on("error", (error) => {
			reportError({
				title: "Generic Error",
				description: `${inlineCode('client.on("error", () => {...}))')} caught an error.`,
				error,
			});
		});

		this.on("interactionCreate", async (interaction) => {
			if (!interaction.isChatInputCommand()) return;

			if (await database.getBooleanFlag("log.commands")) this.logCommand(interaction);

			const command = this.commandRegistry.get(interaction.commandName);
			if (!command) throw new Error(`Command ${interaction.commandName} not implemented`);

			await Client.loadedOnceSignal;

			await this.runCommand(interaction, command);
		});

		this.on("interactionCreate", async (interaction) => {
			if (!interaction.isContextMenuCommand()) return;

			if (await database.getBooleanFlag("log.contextMenuItems")) this.logContextMenuItem(interaction);
			const item = this.contextMenuItemsRegistry.get(interaction.commandName);
			if (!item) throw new Error(`Context Menu Item ${interaction.commandName} not implemented`);

			await Client.loadedOnceSignal;

			await this.runContextMenuItem(interaction, item);
		});

		this.on("interactionCreate", async (interaction) => {
			if (!interaction.isAutocomplete()) return;

			const command = this.commandRegistry.get(interaction.commandName);
			if (!command) throw new Error(`Autocomplete ${interaction.commandName} not implemented`);

			await Client.loadedOnceSignal;

			await this.autocompleteCommand(interaction, command);
		});

		await this.login(process.env.TOKEN);
	}

	private logEvent(event: Event<keyof ClientEvents>) {
		logger.debug("[E]", event.event);
	}

	private logContextMenuItem(interaction: MessageContextMenuCommandInteraction | UserContextMenuCommandInteraction) {
		logger.debug(
			`@${interaction.user.username} used ${interaction.commandName} on ${
				interaction.isMessageContextMenuCommand()
					? `message "${interaction.targetMessage.content.replaceAll("\n", "\\n")}" from @${
							interaction.targetMessage.author.username
						}`
					: `@${interaction.targetUser.username}`
			}`,
		);
	}

	private async runContextMenuItem(
		this: Client<true>,
		interaction: ContextMenuCommandInteraction,
		item: ContextMenuItem<"Message" | "User">,
	) {
		if (item.ownerOnly && interaction.user !== this.owner.user)
			return void (await interaction.reply({
				content: "This context menu item can only be used by the owner.",
				ephemeral: true,
			}));
		if (
			(item.type === "Message" && interaction.isMessageContextMenuCommand()) ||
			(item.type === "User" && interaction.isUserContextMenuCommand())
		)
			await item.execute({ client: this, interaction });
	}

	private async autocompleteCommand(
		this: Client<true>,
		interaction: AutocompleteInteraction,
		command: CommandRegistryItem,
	) {
		const subcommandName = interaction.options.getSubcommand(false);
		const executable = subcommandName ? this.getSubcommand(interaction, subcommandName, command) : command;
		await executable.autocomplete?.({ client: this, interaction });
	}

	private logCommand(interaction: ChatInputCommandInteraction) {
		const parts = [`@${interaction.user.username} called /${interaction.commandName}`];
		if (interaction.options.data.length > 0)
			parts.push(
				...interaction.options.data.flatMap(function recursive(v): string[] {
					return [
						v.type === ApplicationCommandOptionType.Subcommand ||
						v.type === ApplicationCommandOptionType.SubcommandGroup
							? v.name
							: `${v.name}: ${
									(v.user && `@${v.user.username}`) ??
									(v.role && `@${v.role.name}`) ??
									(v.channel && `#${v.channel.name}`) ??
									(v.message &&
										`"${v.message.content.replaceAll("\n", "\\n")}" from @${
											v.message.author.username
										}`) ??
									v.value
								}`,
						...(v.options ? v.options.flatMap((v) => recursive.call(undefined, v)) : []),
					];
				}),
			);
		logger.debug(parts.join(" "));
	}

	private async restrictCommand(
		this: Client<true>,
		interaction: ChatInputCommandInteraction,
		command: Command | Subcommand,
	) {
		if (
			(command.ownerOnly && interaction.user !== this.owner.user) ||
			(command.userAllowList &&
				!(command.userAllowList.includes(interaction.user.id) || interaction.user === this.owner.user))
		) {
			await interaction.reply({
				content: "Sorry, you aren't allowed to use this command...",
				ephemeral: true,
			});
			return false;
		}
		if (command.guildOnly && !interaction.inCachedGuild()) {
			await interaction.reply({
				content: "Sorry, this command can only be used in a server...",
				ephemeral: true,
			});
			return false;
		}
		return true;
	}

	private getSubcommand(
		interaction: ChatInputCommandInteraction | AutocompleteInteraction,
		subcommandName: string,
		command: CommandRegistryItem,
	) {
		const subcommandGroup = interaction.options.getSubcommandGroup();
		const subcommands = subcommandGroup
			? command.subcommandGroups.get(subcommandGroup)?.subcommands
			: command.subcommands;
		if (!subcommands) throw new Error(`SubcommandGroup ${subcommandGroup} in /${interaction.commandName}`);
		const subcommand = subcommands.get(subcommandName);
		if (!subcommand)
			throw new Error(
				`Subcommand ${subcommandName} in ${subcommandGroup ? `${subcommandGroup} of ` : ""}${interaction.commandName}`,
			);
		return subcommand;
	}

	private async runCommand(
		this: Client<true>,
		interaction: ChatInputCommandInteraction,
		command: CommandRegistryItem,
	) {
		if (!(await this.restrictCommand(interaction, command))) return;
		const subcommandName = interaction.options.getSubcommand(false);
		if (subcommandName) {
			const subcommand = this.getSubcommand(interaction, subcommandName, command);
			if (!(await this.restrictCommand(interaction, subcommand))) return;
			if (subcommand.defer) await interaction.deferReply({ ephemeral: subcommand.defer === "ephemeral" });
			try {
				await subcommand.execute({ client: this, interaction });
			} catch (e) {
				reportError({
					title: `Command error: /${interaction.commandName}`,
					description: "An error was thrown while running a command.",
					error: e as Error,
					affectedUser: interaction.member instanceof GuildMember ? interaction.member : interaction.user,
					interaction,
				});
			}
		} else {
			if (command.defer) await interaction.deferReply({ ephemeral: command.defer === "ephemeral" });
			try {
				// already reported by sanity checks
				await command.execute!({ client: this, interaction });
			} catch (e) {
				reportError({
					title: `Command error: /${interaction.commandName}`,
					description: "An error was thrown while running a command.",
					error: e as Error,
					affectedUser: interaction.member instanceof GuildMember ? interaction.member : interaction.user,
					interaction,
				});
			}
		}
	}
}
