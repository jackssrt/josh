// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./src/types/env.d.ts"></reference>

import consola from "consola";
import type { ClientEvents, InteractionReplyOptions, MessageCreateOptions, PresenceData } from "discord.js";
import { ActivityType, Client as DiscordClient, EmbedBuilder, GatewayIntentBits } from "discord.js";
import type Command from "./command.js";
import type { ContextMenuItem } from "./contextMenuItem.js";
import getEnv, { IS_BUILT, IS_DEV } from "./env.js";
import type Event from "./event.js";
import Registry from "./registry.js";
import { errorEmbeds, formatTime, parallel, pluralize } from "./utils.js";
consola.wrapAll();
export const USER_AGENT =
	"Splat Squad Bot (source code: https://github.com/jackssrt/splatsquad-bot , make an issue if it's misbehaving)";
export default class Client<Ready extends boolean = false> extends DiscordClient<Ready> {
	public commandRegistry = new Registry<Command>();
	public eventRegistry = new Registry<Event<keyof ClientEvents>>();
	public contextMenuItemsRegistry = new Registry<ContextMenuItem<"User" | "Message">>();
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
	public async load() {
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
	public async start() {
		for (const event of this.eventRegistry.values()) {
			this[event.isOnetime ? "once" : "on"](event.event, (...params: ClientEvents[typeof event.event]) =>
				event.on({ client: this as Client<true> }, ...params),
			);
		}
		consola.success(`Hooked ${this.eventRegistry.size} event${this.eventRegistry.size === 1 ? "" : "s"}`);

		this.on("error", async (error) => {
			const owner = await this.users.fetch(getEnv("OWNER_ID"));
			await owner.send(
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
			if (command.ownerOnly && interaction.user.id !== getEnv("OWNER_ID"))
				return void (await interaction.reply({
					content: "This command can only be used by the owner.",
					ephemeral: true,
				}));
			if (command.defer) await interaction.deferReply({ ephemeral: command.defer === "ephemeral" });
			try {
				await command.execute({ client: this as Client<true>, interaction });
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
							const owner = await this.users.fetch(getEnv("OWNER_ID"));
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
			if (item.ownerOnly && interaction.user.id !== getEnv("OWNER_ID"))
				return void (await interaction.reply({
					content: "This context menu item can only be used by the owner.",
					ephemeral: true,
				}));
			if (item.type === "Message" && interaction.isMessageContextMenuCommand())
				await item.execute({ client: this as Client<true>, interaction });
			else if (item.type === "User" && interaction.isUserContextMenuCommand())
				await item.execute({ client: this as Client<true>, interaction });
		});
		this.on("interactionCreate", async (interaction) => {
			if (!interaction.isAutocomplete()) return;
			const command = this.commandRegistry.get(interaction.commandName);

			await command?.autocomplete?.({ client: this as Client<true>, interaction });
		});
		await this.login(getEnv("TOKEN"));
		if (IS_DEV) await (await this.users.fetch(getEnv("OWNER_ID"))).send("✅ Started");
	}
}
