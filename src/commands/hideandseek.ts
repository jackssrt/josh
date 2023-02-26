import { randomInt } from "crypto";
import type { APIEmbedField, ButtonInteraction, ChatInputCommandInteraction, Message, User } from "discord.js";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	Collection,
	ComponentType,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
	TimestampStyles,
	userMention,
} from "discord.js";
import type Command from "../command.js";
import { BOOYAH_EMOJI, BULLET_EMOJI, EMPTY_EMOJI, OUCH_EMOJI, SQUIDSHUFFLE_EMOJI, SUB_EMOJI } from "../emojis.js";
import { embeds, getRandomValues, wait } from "../utils.js";

const SECONDS_TO_JOIN = 60 * 2;
const SECONDS_TO_PICK_TEAMS = 60 * 5;

const ROLE_ICON_MAP = {
	[PlayerRole.Seeker]: "🏃",
	[PlayerRole.Hider]: "<:veemoPeek:1075825973020340245>",
} as const;

const RULES = `${BULLET_EMOJI}No location revealing specials:
${EMPTY_EMOJI}${SUB_EMOJI}${BULLET_EMOJI}Tenta missiles
${EMPTY_EMOJI}${EMPTY_EMOJI}${BULLET_EMOJI}Killer wail 5.1
${EMPTY_EMOJI}${EMPTY_EMOJI}${BULLET_EMOJI}Wave breaker
${BULLET_EMOJI}No ninja squid.
${BULLET_EMOJI}No hiding in your own base.

${BULLET_EMOJI}First the hiders will pick their hiding spots
${BULLET_EMOJI}After 1 minute in turf war or 2 minutes in ranked,
${EMPTY_EMOJI}the seekers will go look for the hiders.

${BULLET_EMOJI}**Seekers ${ROLE_ICON_MAP[PlayerRole.Seeker]}**
${EMPTY_EMOJI}${SUB_EMOJI}${BULLET_EMOJI}aren't allowed to use the map during hiding time
${EMPTY_EMOJI}${EMPTY_EMOJI}${BULLET_EMOJI}aren't allowed to use sub weapons while seeking for hiders
${EMPTY_EMOJI}${EMPTY_EMOJI}${BULLET_EMOJI}are allowed to super jump to squid beacons and big bubblers
${EMPTY_EMOJI}${EMPTY_EMOJI}${BULLET_EMOJI}win if they splat all hiders once

${BULLET_EMOJI}**Hiders ${ROLE_ICON_MAP[PlayerRole.Hider]}**
${EMPTY_EMOJI}${SUB_EMOJI}${BULLET_EMOJI}aren't allowed to use the map
${EMPTY_EMOJI}${EMPTY_EMOJI}${BULLET_EMOJI}are allowed to fight back with their main weapons, sub weapons, special weapons if they get found
${EMPTY_EMOJI}${EMPTY_EMOJI}${BULLET_EMOJI}win if they survive until 5 seconds before the match ends`;
const SEEKER_EXPLANATION = `${BULLET_EMOJI}As a seeker you're first going to back up and face away from the map.
${BULLET_EMOJI}Meanwhile the hiders are going to be painting the map and picking their hiding spots...
${BULLET_EMOJI}Only after hiding time is up can you start seeking!
${BULLET_EMOJI}Remember that the hiders can fight back!`;
const HIDER_EXPLANATION = `${BULLET_EMOJI}As a hider you're going to head straight to the other teams base or mid,
${EMPTY_EMOJI}paint it and find a good hiding spot.
${BULLET_EMOJI}The seekers will start seeking after I send a message saying that hiding time is up.
${BULLET_EMOJI}When there's 5 seconds left of the match you can reveal your hiding spot if you want, you've won!`;

const enum GameState {
	WaitingForPlayers,
	DecidingTeams,
	WaitingForMatchStart,
	HideTime,
	SeekTime,
}

class Game {
	public players = new Collection<User, Player>();
	public host: Player<true>;
	public createdTime = new Date();
	// smallest possible date
	public startedTime = new Date(-8640000000000000);
	private state: GameState = GameState.WaitingForPlayers;

	constructor(
		private msg: Message,
		hostInteraction: ChatInputCommandInteraction,
		private code: string,
		private mode: "turfwar" | "ranked",
	) {
		const host = new Player(hostInteraction, true as const, undefined);
		this.players.set(hostInteraction.user, host);
		this.host = host;
	}

	public addPlayer(interaction: ButtonInteraction) {
		this.players.set(interaction.user, new Player(interaction, false as const, undefined));
	}

	public playerList(): string {
		return (
			this.players
				.map(
					(v) =>
						`${v.role !== undefined ? ROLE_ICON_MAP[v.role] : v.isHost ? "👑" : "👤"} - ${v.user.username}`,
				)
				.join("\n") || "no players"
		);
	}
	public playerListField(): APIEmbedField {
		return { name: "👥 Player list", value: this.playerList() };
	}

	public async decideTeams(hostConfigInteraction: ButtonInteraction) {
		this.state = GameState.DecidingTeams;
		await this.updateMainMessage();
		const maxSeekers = Math.min(4, this.players.size - 1);
		const pickTeams = await hostConfigInteraction.editReply({
			...(await embeds((b) =>
				b
					.setTitle("Decide teams")
					.setDescription(
						`Do you want me to pick the seekers for you or do you want to pick them manually?\nMake a ${this.mode} private battle room with the code \`${this.code}\` while you're waiting for everyone to join.`,
					),
			)),
			content: "",
			components: [
				new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
					new StringSelectMenuBuilder()
						.setCustomId("random")
						.setPlaceholder("🔁 Pick number of random seekers...")
						.addOptions(
							new Array(maxSeekers)
								.fill(false)
								.map((_, i) =>
									new StringSelectMenuOptionBuilder()
										.setLabel(`Pick ${i + 1} random seeker${i + 1 !== 1 ? "s" : ""} for me`)
										.setValue(`${i + 1}`),
								),
						),
				),
				new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
					new StringSelectMenuBuilder()
						.setCustomId("seekers")
						.setMaxValues(maxSeekers)
						.setMinValues(1)
						.setPlaceholder("*️⃣ Pick seekers manually...")
						.addOptions(
							this.players.map((v) =>
								new StringSelectMenuOptionBuilder().setLabel(`${v.user.username}`).setValue(v.user.id),
							),
						),
				),
			],
		});
		const pickTeamsInteraction = await pickTeams.awaitMessageComponent({
			componentType: ComponentType.StringSelect,
			time: SECONDS_TO_PICK_TEAMS * 1000,
		});
		await pickTeamsInteraction.deferUpdate();
		if (pickTeamsInteraction.customId === "random") {
			const amount = parseInt(pickTeamsInteraction.values[0] ?? "-1");
			if (amount === -1) return await this.abort();
			const seekerKeys = getRandomValues(Array.from(this.players.keys()), amount);
			this.players.map((v, k) => {
				v.role = seekerKeys.includes(k) ? PlayerRole.Seeker : PlayerRole.Hider;
				this.players.set(k, v);
			});
		} else {
			this.players.map((v, k) => {
				v.role = pickTeamsInteraction.values.includes(k.id) ? PlayerRole.Seeker : PlayerRole.Hider;
				this.players.set(k, v);
			});
		}
		this.state = GameState.WaitingForMatchStart;
		await this.updateMainMessage();
		await Promise.all(
			this.players.map(async (v) => {
				await v.interaction.followUp({
					...(await embeds((b) =>
						b
							.setTitle(
								`Your role: ${ROLE_ICON_MAP[v.role!]} ${
									v.role === PlayerRole.Seeker ? "Seeker" : "Hider"
								}`,
							)
							.setDescription(v.role === PlayerRole.Seeker ? SEEKER_EXPLANATION : HIDER_EXPLANATION)
							.setFooter({ text: `Room code: ${this.code} ・ Host: ${this.host.user.username}` }),
					)),
					ephemeral: true,
				});
			}),
		);
		const matchStartedMessage = await pickTeamsInteraction.editReply({
			content: `Press the \`Match started!\` button after the game says "Ready?" and "GO!".`,
			embeds: [],
			components: [
				new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder().setLabel("Match started!").setCustomId("started").setStyle(ButtonStyle.Primary),
				),
			],
		});
		const matchStartedInteraction = await matchStartedMessage.awaitMessageComponent({
			componentType: ComponentType.Button,
		});
		await matchStartedInteraction.deferUpdate();
		await matchStartedInteraction.editReply({
			content: "Timer started!\nYou can dismiss this message now.",
			components: [],
			embeds: [],
		});
		this.state = GameState.HideTime;
		this.startedTime = new Date();
		await this.updateMainMessage();
		await wait(this.mode === "turfwar" ? 60 : 2 * 60);
		const hidingTimeUpMessage = await this.host.interaction.followUp({
			content: "**⏰ Hiding time is up! The seekers will now go look for the hiders!**",
			fetchReply: true,
		});
		this.state = GameState.SeekTime;
		await this.updateMainMessage();

		await wait(this.mode === "turfwar" ? 2 * 60 : 3 * 60);
		hidingTimeUpMessage.deletable && (await hidingTimeUpMessage.delete());
		await this.gameFinished();
	}
	public async gameFinished() {
		await this.msg.edit({
			...(await embeds((b) => b.setTitle("Hide and seek game finished").addFields(this.playerListField()))),
		});
	}

	public async abort() {
		await this.msg.edit({
			...(await embeds((b) =>
				b
					.setTitle(`Hide and seek game was aborted ${OUCH_EMOJI}`)
					.setDescription("The game was aborted...")
					.setColor("Red"),
			)),
			components: [],
		});
	}
	public async updateMainMessage() {
		const parts: string[] = ["**Rules**", RULES, ""];
		if (this.state === GameState.WaitingForPlayers)
			parts.push(
				`Expires <t:${Math.floor(this.createdTime.getTime() / 1000) + SECONDS_TO_JOIN}:${
					TimestampStyles.RelativeTime
				}>`,
			);
		else if (this.state === GameState.DecidingTeams)
			parts.push(`${SQUIDSHUFFLE_EMOJI} ${userMention(this.host.user.id)} is deciding teams...`);
		else if (this.state === GameState.WaitingForMatchStart)
			parts.push(`${SQUIDSHUFFLE_EMOJI} Waiting for the match to start...`);
		else if (this.state === GameState.HideTime)
			parts.push(
				`Hiding time ends <t:${
					Math.floor(this.startedTime.getTime() / 1000) + (this.mode === "turfwar" ? 60 : 2 * 60)
				}:${TimestampStyles.RelativeTime}>`,
			);
		else if (this.state === GameState.SeekTime)
			parts.push(
				`Match ends <t:${
					Math.floor(this.startedTime.getTime() / 1000) + (this.mode === "turfwar" ? 3 * 60 : 5 * 60)
				}:${TimestampStyles.RelativeTime}>`,
			);
		await this.msg.edit({
			...(await embeds((b) =>
				b.setTitle("Hide and seek!").setDescription(parts.join("\n")).addFields(this.playerListField()),
			)),
			...(this.state !== GameState.WaitingForPlayers ? { components: [] } : {}),
		});
	}
}
const enum PlayerRole {
	Seeker,
	Hider,
}
class Player<Host = boolean> {
	public user: User;
	constructor(
		public interaction: Host extends true ? ChatInputCommandInteraction : ButtonInteraction,
		public isHost: Host,
		public role: PlayerRole | undefined,
	) {
		this.user = interaction.user;
	}
}

export default {
	data: (b) =>
		b
			.setDescription("Starts a hide and seek game!")
			.addStringOption((b) =>
				b
					.addChoices({ name: "turfwar", value: "turfwar" }, { name: "ranked", value: "ranked" })
					.setDescription("What mode will this game be in?")
					.setName("mode")
					.setRequired(true),
			),
	async execute({ interaction }) {
		const mode = interaction.options.getString("mode", true) as "ranked" | "turfwar";
		const code = `${randomInt(0, 9)}${randomInt(0, 9)}${randomInt(0, 9)}${randomInt(0, 9)}`;
		const msg = await interaction.reply({
			...(await embeds((b) => b.setTitle(`Hide and seek!`).setDescription(`Loading... ${SQUIDSHUFFLE_EMOJI}`))),
			components: [
				new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder()
						.setLabel("I'm in!")
						.setEmoji("➕")
						.setCustomId("join")
						.setStyle(ButtonStyle.Primary),
				),
			],
			fetchReply: true,
		});
		const hostConfigMessage = await interaction.followUp({
			content: `Make a ${mode} private battle room with the code \`${code}\` while you're waiting for everyone to join.\nPay attention to this message and don't dismiss it, I will edit it with options for you to set!\nPress \`Everyone's joined!\` when all players have joined on discord!`,
			components: [
				new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder()
						.setCustomId("quickStart")
						.setLabel("Everyone's joined!")
						.setStyle(ButtonStyle.Primary),
					new ButtonBuilder()
						.setCustomId("abort")
						.setLabel("Abort")
						.setEmoji("✖️")
						.setStyle(ButtonStyle.Danger),
				),
			],
			ephemeral: true,
		});
		hostConfigMessage
			.createMessageComponentCollector({
				componentType: ComponentType.Button,
				max: 1,
				filter: async (x) => {
					await x.deferUpdate();
					if (game.players.size < 2)
						return void (await x.editReply({ content: "Nobody's joined yet!" })) || false;
					return true;
				},
			})
			.on("collect", async (i) => {
				if (i.customId === "quickStart") {
					await i.editReply({ content: `Game started! ${BOOYAH_EMOJI}` });
					collector.stop("started");
					await game.decideTeams(i);
				} else if (i.customId === "abort") {
					await i.editReply({
						content: "The game has been aborted.\nYou can dismiss this message now.",
						components: [],
					});
					await game.abort();
				}
			});
		const game = new Game(msg, interaction, code, mode);
		await game.updateMainMessage();
		const collector = msg.createMessageComponentCollector({
			componentType: ComponentType.Button,
			maxUsers: 7,
			time: SECONDS_TO_JOIN * 1000,
			filter: async (x) =>
				x.user.id === interaction.user.id
					? void (await x.reply({ content: "You're the host!", ephemeral: true })) || false
					: game.players.find((y) => y.user.id === x.user.id)
					? void (await x.reply({ content: "You've already joined!", ephemeral: true })) || false
					: void (await x.reply({
							content: `Joined! ${BOOYAH_EMOJI}\nThe code to join the room is \`${code}\``,
							ephemeral: true,
					  })) || true,
		});
		collector.on("collect", async (collected) => {
			game.addPlayer(collected);
			await game.updateMainMessage();
		});
		collector.once("end", async (_, reason) => {
			if (reason !== "started") await game.abort();
		});
	},
} as Command;
