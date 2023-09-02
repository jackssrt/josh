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
import { spawn } from "node:child_process";
import path from "node:path";
import { platform } from "node:process";
import SyncSignal from "./SyncSignal.js";
import type { Command } from "./command.js";
import type { ContextMenuItem } from "./contextMenuItem.js";
import database from "./database.js";
import { IS_BUILT, IS_DEV } from "./env.js";
import type { Event } from "./event.js";
import logger from "./logger.js";
import Registry from "./registry.js";
import { formatTime, parallel, pluralize, reportError } from "./utils.js";

export const USER_AGENT = "Josh (source code: https://github.com/jackssrt/josh , make an issue if it's misbehaving)";
export default class Client<Ready extends boolean = false, Loaded extends boolean = true> extends DiscordClient<Ready> {
	public commandRegistry = new Registry<Command>();
	public eventRegistry = new Registry<Event<keyof ClientEvents>>();
	public contextMenuItemsRegistry = new Registry<ContextMenuItem<"User" | "Message">>();
	public guild = undefined as Loaded extends true ? Guild : undefined;
	public guildMe = undefined as Loaded extends true ? GuildMember : undefined;
	public owner = undefined as Loaded extends true ? GuildMember : undefined;
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
	public loadedSyncSignal = new SyncSignal();
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
			this.commandRegistry.loadFromDirectory(`./${dirName}/commands`),
			this.eventRegistry.loadFromDirectory(`./${dirName}/events`),
			this.contextMenuItemsRegistry.loadFromDirectory(`./${dirName}/contextMenuItems`),
		);
		logger.info(`Loaded ${this.commandRegistry.size} ${pluralize("command", this.commandRegistry.size)}`);
		new Set(this.commandRegistry.values()).forEach((v) => {
			v.aliases?.forEach((alias) => {
				this.commandRegistry.set(alias, v);
			});
		});

		// sanity checks

		this.commandRegistry.forEach((v, k) => {
			function fail(reason: string) {
				logger.error(`${k} command failed sanity check, ${reason} not defined`);
			}
			if (!v.data) fail("data");
			if (!v.execute) fail("execute");
		});
		this.eventRegistry.forEach((v, k) => {
			function fail(reason: string) {
				logger.error(`${k} event failed sanity check, ${reason} not defined`);
			}
			if (!v.event) fail("event");
			if (!v.on) fail("on()");
		});
		this.contextMenuItemsRegistry.forEach((v, k) => {
			function fail(reason: string) {
				logger.error(`${k} contextMenuItem failed sanity check, ${reason} not defined`);
			}
			if (!v.data) fail("data");
			if (!v.execute) fail("execute()");
			if (!v.type) fail("type");
		});
		/* eslint-enable @typescript-eslint/no-unnecessary-condition */
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
			this.guild = await this.guilds.fetch(process.env.GUILD_ID);
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
			);
			logger.info(`Fetching discord objects took ${formatTime((new Date().getTime() - start.getTime()) / 1000)}`);
			this.loadedSyncSignal.fire();
			if (IS_DEV && platform === "win32")
				spawn(`powershell.exe`, [
					"-c",
					`$player = New-Object System.Media.SoundPlayer;$player.SoundLocation = '${path.resolve(
						"./assets/startup.wav",
					)}';$player.playsync();`,
				]);
			logger.info("Ready!");
		});

		for (const event of this.eventRegistry.values()) {
			this[event.isOnetime ? "once" : "on"](event.event, async (...params: ClientEvents[typeof event.event]) => {
				await this.loadedSyncSignal.await();
				if (await database.getBooleanFlag("log.events")) this.logEvent(event);
				await event.on({ client: this }, ...params);
			});
		}
		logger.info(`Hooked ${this.eventRegistry.size} event${this.eventRegistry.size === 1 ? "" : "s"}`);

		this.on("error", async (error) => {
			await this.loadedSyncSignal.await();
			await reportError(this, {
				title: "Generic Error",
				description: `${inlineCode('client.on("error", () => {...}))')} caught an error.`,
				error,
			});
		});

		this.on("interactionCreate", async (interaction) => {
			if (!interaction.isChatInputCommand()) return;

			if (await database.getBooleanFlag("log.commands")) this.logCommand(interaction);

			const command = this.commandRegistry.get(interaction.commandName);
			if (!command) return;

			await this.loadedSyncSignal.await();

			await this.runCommand(interaction, command);
		});

		this.on("interactionCreate", async (interaction) => {
			if (!interaction.isContextMenuCommand()) return;

			if (await database.getBooleanFlag("log.contextMenuItems")) this.logContextMenuItem(interaction);
			const item = this.contextMenuItemsRegistry.get(interaction.commandName);
			if (!item) return;

			await this.loadedSyncSignal.await();

			await this.runContextMenuItem(interaction, item);
		});

		this.on("interactionCreate", async (interaction) => {
			if (!interaction.isAutocomplete()) return;

			const command = this.commandRegistry.get(interaction.commandName);
			if (!command) return;

			await this.loadedSyncSignal.await();

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
					? `message "${interaction.targetMessage.content.replace(/\n/g, "\\n")}" from @${
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

	private async autocompleteCommand(this: Client<true>, interaction: AutocompleteInteraction, command: Command) {
		await command.autocomplete?.({ client: this, interaction });
	}

	private logCommand(interaction: ChatInputCommandInteraction) {
		const parts = [`@${interaction.user.username} called /${interaction.commandName}`];
		if (interaction.options.data.length)
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
										`"${v.message.content.replace(/\n/g, "\\n")}" from @${
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

	private async runCommand(this: Client<true>, interaction: ChatInputCommandInteraction, command: Command) {
		if (
			(command.ownerOnly && interaction.user !== this.owner.user) ||
			(command.userAllowList &&
				!(command.userAllowList.includes(interaction.user.id) || interaction.user === this.owner.user))
		)
			return void (await interaction.reply({
				content: "Sorry, you aren't allowed to use this command...",
				ephemeral: true,
			}));
		if (command.guildOnly && !interaction.inGuild())
			return void (await interaction.reply("Sorry, this command can only be used in a server..."));
		if (command.defer) await interaction.deferReply({ ephemeral: command.defer === "ephemeral" });
		try {
			await command.execute({ client: this, interaction });
		} catch (e) {
			await reportError(this, {
				title: `Command error: /${interaction.commandName}`,
				description: "An error was thrown while running a command.",
				error: e as Error,
				affectedUser: interaction.member instanceof GuildMember ? interaction.member : interaction.user,
				interaction,
			});
		}
	}
}
