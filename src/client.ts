// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./src/types/env.d.ts"></reference>

import consola from "consola";
import type { ClientEvents, InteractionReplyOptions, MessageCreateOptions, PresenceData } from "discord.js";
import { ActivityType, Client as DiscordClient, EmbedBuilder, GatewayIntentBits } from "discord.js";
import type Command from "./command.js";
import type { ContextMenuItem } from "./contextMenuItem.js";
import type Event from "./event.js";
import Registry from "./registry.js";
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
		// TODO add if dev thing here
		await this.commandRegistry.loadFromDirectory("./src/commands");
		consola.success(`Loaded ${this.commandRegistry.size} command${this.commandRegistry.size === 1 ? "" : "s"}`);
		await this.eventRegistry.loadFromDirectory("./src/events");
		consola.success(`Loaded ${this.eventRegistry.size} event${this.eventRegistry.size === 1 ? "" : "s"}`);
		await this.contextMenuItemsRegistry.loadFromDirectory("./src/contextMenuItems");
		consola.success(
			`Loaded ${this.contextMenuItemsRegistry.size} context menu item${
				this.contextMenuItemsRegistry.size === 1 ? "" : "s"
			}`,
		);
	}
	public async start() {
		for (const event of this.eventRegistry.values()) {
			this[event.isOnetime ? "once" : "on"](event.event, (...params: ClientEvents[typeof event.event]) =>
				event.on({ client: this as Client<true> }, ...params),
			);
		}
		consola.success(`Hooked ${this.eventRegistry.size} event${this.eventRegistry.size === 1 ? "" : "s"}`);

		this.on("interactionCreate", async (interaction) => {
			if (!interaction.isChatInputCommand()) return;

			const command = this.commandRegistry.get(interaction.commandName);
			if (!command) return;
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
							const owner = await this.users.fetch(process.env["OWNER_ID"]!);
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
			if (item.type === "Message" && interaction.isMessageContextMenuCommand())
				await item.execute({ client: this as Client<true>, interaction });
			else if (item.type === "User" && interaction.isUserContextMenuCommand())
				await item.execute({ client: this as Client<true>, interaction });
		});
		await this.login(process.env["TOKEN"]!);
		await (await this.users.fetch(process.env["OWNER_ID"]!)).send("✅ Started");
	}
}
