// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./src/types/env.d.ts"></reference>

import consola from "consola";
import type {
	CategoryChannel,
	ClientEvents,
	Guild,
	GuildMember,
	InteractionReplyOptions,
	MessageCreateOptions,
	NewsChannel,
	PresenceData,
	Role,
	TextChannel,
} from "discord.js";
import { ActivityType, Client as DiscordClient, EmbedBuilder, GatewayIntentBits } from "discord.js";
import { spawn } from "node:child_process";
import path from "node:path";
import { platform } from "node:process";
import SyncSignal from "./SyncSignal.js";
import type Command from "./command.js";
import type { ContextMenuItem } from "./contextMenuItem.js";
import getEnv, { IS_BUILT, IS_DEV } from "./env.js";
import type Event from "./event.js";
import Registry from "./registry.js";
import { errorEmbeds, formatTime, parallel, pluralize } from "./utils.js";
consola.wrapAll();
export const USER_AGENT =
	"Splat Squad Bot (source code: https://github.com/jackssrt/splatsquad-bot , make an issue if it's misbehaving)";
export default class Client<Ready extends boolean = false, Loaded extends boolean = true> extends DiscordClient<Ready> {
	public commandRegistry = new Registry<Command>();
	public eventRegistry = new Registry<Event<keyof ClientEvents>>();
	public contextMenuItemsRegistry = new Registry<ContextMenuItem<"User" | "Message">>();
	public guild = undefined as Loaded extends true ? Guild : undefined;
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
	private static readonly defaultPresence: PresenceData = {
		status: "online",
		activities: [{ type: ActivityType.Competing, name: "Splatoon 3" }],
	};
	constructor() {
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
			presence: Client.defaultPresence,
		});
	}
	public resetPresence() {
		this.user?.setPresence(Client.defaultPresence);
	}
	public async load(this: Client) {
		const dirName = IS_BUILT ? "build" : "src";
		const start = new Date();

		await parallel(
			this.commandRegistry.loadFromDirectory(`./${dirName}/commands`),
			this.eventRegistry.loadFromDirectory(`./${dirName}/events`),
			this.contextMenuItemsRegistry.loadFromDirectory(`./${dirName}/contextMenuItems`),
		);
		consola.success(`Loaded ${this.commandRegistry.size} ${pluralize("command", this.commandRegistry.size)}`);
		new Set(this.commandRegistry.values()).forEach((v) => {
			v.aliases?.forEach((alias) => {
				this.commandRegistry.set(alias, v);
			});
		});

		// sanity checks
		/* eslint-disable @typescript-eslint/no-unnecessary-condition */
		this.commandRegistry.forEach((v, k) => {
			function fail(reason: string) {
				consola.error(`${k} command failed sanity check, ${reason} not defined`);
			}
			if (!v.data) fail("data");
			if (!v.execute) fail("execute");
		});
		this.eventRegistry.forEach((v, k) => {
			function fail(reason: string) {
				consola.error(`${k} event failed sanity check, ${reason} not defined`);
			}
			if (!v.event) fail("event");
			if (!v.on) fail("on()");
		});
		this.contextMenuItemsRegistry.forEach((v, k) => {
			function fail(reason: string) {
				consola.error(`${k} contextMenuItem failed sanity check, ${reason} not defined`);
			}
			if (!v.data) fail("data");
			if (!v.execute) fail("execute()");
			if (!v.type) fail("type");
		});
		/* eslint-enable @typescript-eslint/no-unnecessary-condition */
		const end = new Date();
		consola.success(`Loaded ${this.eventRegistry.size} ${pluralize("event", this.eventRegistry.size)}`);
		consola.success(
			`Loaded ${this.contextMenuItemsRegistry.size} ${pluralize(
				"context menu item",
				this.contextMenuItemsRegistry.size,
			)}`,
		);
		consola.success(`Loading took ${formatTime((end.getTime() - start.getTime()) / 1000)}`);
	}
	public async start(this: Client<true>) {
		this.on("ready", async () => {
			consola.info("Fetching discord objects phase 1...");
			const start = new Date();
			this.guild = await this.guilds.fetch(getEnv("GUILD_ID"));
			consola.info("Fetching discord objects phase 2...");
			[
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
				this.guild.members.fetch(getEnv("OWNER_ID")),
				this.guild.channels.fetch(getEnv("VOICE_CATEGORY_ID")) as Promise<CategoryChannel>,
				this.guild.channels.fetch(getEnv("UNUSED_VOICE_CATEGORY_ID")) as Promise<CategoryChannel>,
				this.guild.channels.fetch(getEnv("GENERAL_CHANNEL_ID")) as Promise<TextChannel>,
				this.guild.roles.fetch(getEnv("MEMBER_ROLE_ID")) as Promise<Role>,
				this.guild.channels.fetch(getEnv("JOIN_LEAVE_CHANNEL_ID")) as Promise<TextChannel>,
				this.guild.channels.fetch(getEnv("MAPS_CHANNEL_ID")) as Promise<NewsChannel>,
				this.guild.channels.fetch(getEnv("SALMON_RUN_CHANNEL_ID")) as Promise<NewsChannel>,
				this.guild.roles.fetch(getEnv("COLORS_ROLE_CATEGORY_ID")) as Promise<Role>,
				this.guild.channels.fetch(getEnv("STATS_CHANNEL_ID")) as Promise<TextChannel>,
				this.guild.roles.fetch(getEnv("SPLATFEST_TEAM_CATEGORY_ROLE_ID")) as Promise<Role>,
			);
			consola.success(
				`Fetching discord objects took ${formatTime((new Date().getTime() - start.getTime()) / 1000)}`,
			);
			this.loadedSyncSignal.fire();
		});

		for (const event of this.eventRegistry.values()) {
			this[event.isOnetime ? "once" : "on"](event.event, async (...params: ClientEvents[typeof event.event]) => {
				await this.loadedSyncSignal.await();
				await event.on({ client: this }, ...params);
			});
		}
		consola.success(`Hooked ${this.eventRegistry.size} event${this.eventRegistry.size === 1 ? "" : "s"}`);

		this.on("error", async (error) => {
			await this.loadedSyncSignal.await();
			await this.owner.send(
				await errorEmbeds({
					title: "Generic Error",
					description: `${error.name} ${error.message}\n${error.stack ?? "no stack"}`,
				}),
			);
		});

		this.on("interactionCreate", async (interaction) => {
			if (!interaction.isChatInputCommand()) return;

			const command = this.commandRegistry.get(interaction.commandName);
			if (!command) return;
			await this.loadedSyncSignal.await();
			if (command.ownerOnly && interaction.user !== this.owner.user)
				return void (await interaction.reply({
					content: "This command can only be used by the owner.",
					ephemeral: true,
				}));
			if (
				command.userAllowList &&
				!(command.userAllowList.includes(interaction.user.id) || interaction.user === this.owner.user)
			)
				return void (await interaction.reply({
					content: "Sorry, you aren't allowed to use this command...",
					ephemeral: true,
				}));
			if (command.defer) await interaction.deferReply({ ephemeral: command.defer === "ephemeral" });
			try {
				await command.execute({ client: this, interaction });
			} catch (e) {
				consola.error(e);
				const data = {
					embeds: [
						new EmbedBuilder()
							.setTitle(":( An error occurred")
							.setColor("Red")
							.setDescription(
								`The following error was thrown while running command \`/${
									interaction.commandName
								}${interaction.options.data.reduce(
									(p, v) => `${p} ${v.name}:${v.value?.toString() ?? "undefined"}`,
									"",
								)}\`:\n${(e as Error).name} - ${(e as Error).message || "No message provided."}`,
							),
					],
					ephemeral: true,
					components: [],
				} as InteractionReplyOptions;
				try {
					await interaction.reply(data);
				} catch {
					try {
						await interaction.editReply(data);
					} catch {
						try {
							const owner = this.owner.user;
							await owner.send(data as MessageCreateOptions);
							await interaction.user.send(data as MessageCreateOptions);
						} catch {
							consola.error("everything failed while trying to send error message");
						}
					}
				}
			}
		});
		this.on("interactionCreate", async (interaction) => {
			if (!interaction.isContextMenuCommand()) return;
			const item = this.contextMenuItemsRegistry.get(interaction.commandName);
			if (!item) return;
			await this.loadedSyncSignal.await();
			if (item.ownerOnly && interaction.user !== this.owner.user)
				return void (await interaction.reply({
					content: "This context menu item can only be used by the owner.",
					ephemeral: true,
				}));
			if (item.type === "Message" && interaction.isMessageContextMenuCommand())
				await item.execute({ client: this, interaction });
			else if (item.type === "User" && interaction.isUserContextMenuCommand())
				await item.execute({ client: this, interaction });
		});
		this.on("interactionCreate", async (interaction) => {
			if (!interaction.isAutocomplete()) return;

			const command = this.commandRegistry.get(interaction.commandName);
			await this.loadedSyncSignal.await();
			await command?.autocomplete?.({ client: this, interaction });
		});
		await this.login(getEnv("TOKEN"));
		if (IS_DEV && platform === "win32")
			spawn(`powershell.exe`, [
				"-c",
				`$player = New-Object System.Media.SoundPlayer;$player.SoundLocation = '${path.resolve(
					"./assets/startup.wav",
				)}';$player.playsync();`,
			]);
	}
}
