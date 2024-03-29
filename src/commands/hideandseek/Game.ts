import OnceSignal from "@/utils/OnceSignal.js";
import type {
	APIEmbedField,
	ButtonInteraction,
	ChatInputCommandInteraction,
	GuildMember,
	InteractionReplyOptions,
	Message,
	StringSelectMenuInteraction,
} from "discord.js";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	Collection,
	ComponentType,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
	userMention,
} from "discord.js";
import { BOOYAH_EMOJI, SQUID_SHUFFLE_EMOJI, VEEMO_PEEK_EMOJI } from "../../emojis.js";
import { IS_PROD } from "../../env.js";
import { fillArray, getRandomValues } from "../../utils/array.js";
import { constructEmbedsWrapper, embeds } from "../../utils/discord/embeds.js";
import { parallel, parallelRace } from "../../utils/promise.js";
import { dedent, messageHiddenText } from "../../utils/string.js";
import { SMALLEST_DATE, futureTimestamp, wait } from "../../utils/time.js";
import Player from "./Player.js";
import {
	PlayerRole,
	RULES,
	SECONDS_TO_CONFIRM_LEAVE,
	SECONDS_TO_JOIN,
	SECONDS_TO_PICK_TEAMS,
	SECONDS_TO_PLAY_AGAIN,
} from "./consts.js";

export const enum GameState {
	WaitingForPlayers,
	DecidingTeams,
	WaitingForMatchStart,
	HideTime,
	SeekTime,
	PlayAgain,
}
type DefinedAt<State extends GameState, DefinedStates extends GameState, Type> = State extends DefinedStates
	? Type
	: Type | undefined;
type NotDefinedAt<State extends GameState, NotDefinedStates extends GameState, Type> = State extends NotDefinedStates
	? Type | undefined
	: Type;
const abortButton = new ButtonBuilder()
	.setCustomId("abort")
	.setLabel("Abort")
	.setEmoji("✖️")
	.setStyle(ButtonStyle.Danger);

export default class Game<State extends GameState = GameState.WaitingForPlayers> {
	public players = new Collection<GuildMember, Player>();
	public host: Player<true>;
	public createdTime = SMALLEST_DATE;
	public startedTime = SMALLEST_DATE;
	private state = GameState.WaitingForPlayers as State;
	private hostConfigInteraction = undefined as NotDefinedAt<State, GameState.WaitingForPlayers, ButtonInteraction>;
	private mainMessage = undefined as NotDefinedAt<State, GameState.WaitingForPlayers, Message>;
	private playedAgain = false;
	private hidingTimeUpMsg = undefined as DefinedAt<State, GameState.SeekTime, Message>;
	private startedMessage = undefined as DefinedAt<State, GameState.HideTime, Message>;
	private readonly hideTimeSeconds: number;
	private readonly seekTimeSeconds: number;
	private aborted = false;

	// eslint-disable-next-line unicorn/consistent-function-scoping
	private readonly hostConfigEmbeds = constructEmbedsWrapper((b) =>
		b.setFooter({
			text: `Room type: ${this.mode === "turfwar" ? "Turf War" : "Ranked"}・Room code: ${
				this.code
			}・⚠️ Don't dismiss this message!`,
		}),
	);

	constructor(
		hostInteraction: ChatInputCommandInteraction<"cached">,
		private readonly mode: "turfwar" | "ranked",
		private readonly maxPlayers: number,
		public readonly code: string,
	) {
		const host = new Player(hostInteraction, true as const, undefined, undefined, this.code);
		this.players.set(hostInteraction.member, host);
		this.host = host;
		this.hideTimeSeconds = IS_PROD ? (this.mode === "turfwar" ? 1 : 2) * 60 : 5;
		this.seekTimeSeconds = IS_PROD ? (this.mode === "turfwar" ? 2 : 3) * 60 : 10;
	}

	public addPlayer(interaction: ButtonInteraction<"cached">) {
		const p = new Player(interaction, false as const, undefined, this.host, this.code);
		this.players.set(interaction.member, p);
		return p;
	}

	public playerListField(): APIEmbedField {
		const name = `👥 Player list (\`${this.players.size}/${this.maxPlayers}\`)`;
		if (this.players.first()?.role === undefined) {
			return {
				name,
				value:
					this.players
						.toJSON()
						.map((v) => v.playerListItem())
						.join("\n") || "no players",
			};
		} else {
			const [seekers, hiders] = this.players.partition((v) => v.role === PlayerRole.Seeker);

			return {
				name,
				value: dedent`**🟨 Alpha Team (\`${hiders.size}/4\`)**
									${hiders.map((v) => v.playerListItem()).join("\n")}

									**🟦 Bravo Team (\`${seekers.size}/4\`)**
									${seekers.map((v) => v.playerListItem()).join("\n")}`,
			};
		}
	}
	private async awaitPlayers(this: Game): Promise<boolean | undefined> {
		this.state = GameState.WaitingForPlayers;
		const data = {
			...(await embeds((b) => b.setDescription(`${SQUID_SHUFFLE_EMOJI} Setting everything up...`))),
			components: [
				new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder()
						.setLabel("I'm in!")
						.setEmoji("➕")
						.setCustomId("join")
						.setStyle(ButtonStyle.Success),
				),
			],
			fetchReply: true,
		} as InteractionReplyOptions & { fetchReply: true };
		this.mainMessage = this.playedAgain
			? await this.host.interaction.followUp(data)
			: await this.host.interaction.reply(data);

		this.createdTime = new Date();
		for (const v of this.players.values()) {
			v.role = undefined;
		}
		await this.updateMainMessage();
		const startedOnceSignal = new OnceSignal();

		const hostConfigMessage = await this.host.interaction.followUp({
			embeds: [
				...(await this.host.roleEmbed()).embeds,
				...(
					await this.hostConfigEmbeds((b) =>
						b
							.setTitle("Waiting for players...")
							.setDescription("Press `Everyone's joined!` once all players have joined on discord!"),
					)
				).embeds,
			],
			components: [
				new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder()
						.setCustomId("start")
						.setLabel("Everyone's joined!")
						.setEmoji("✔️")
						.setStyle(ButtonStyle.Success),
					abortButton,
				),
			],
			ephemeral: true,
		});
		const hostConfigCollector = hostConfigMessage.createMessageComponentCollector({
			componentType: ComponentType.Button,
			filter: async (x) => {
				if (x.customId === "start" && this.players.size < 2)
					return !!void (await x.reply({ content: "Nobody's joined yet!", ephemeral: true }));
				return true;
			},
		});
		hostConfigCollector.on("collect", async (hostActionInteraction) => {
			await hostActionInteraction.deferUpdate();
			this.hostConfigInteraction = hostActionInteraction;
			if (hostActionInteraction.customId === "start") {
				joinCollector.stop("started");
				startedOnceSignal.fire();
			} else {
				await this.abort();
				return;
			}
		});
		const joinCollector = this.mainMessage.createMessageComponentCollector({
			componentType: ComponentType.Button,
			time: SECONDS_TO_JOIN * 1000,
			filter: async (x) =>
				x.inCachedGuild()
					? this.players.size >= this.maxPlayers && !this.players.has(x.member)
						? !!void (await x.reply({ content: "Sorry, this game is full!", ephemeral: true }))
						: x.user.id === this.host.member.id
							? !!void (await x.reply({ content: "You're the host!", ephemeral: true }))
							: true
					: false,
		});
		joinCollector.on("collect", async (interaction: ButtonInteraction<"cached">) => {
			if (this.players.has(interaction.member)) {
				// leave
				const leaveConfirmation = await interaction.reply({
					...(await embeds((b) =>
						b
							.setTitle("Do you want to leave?")
							.setDescription(
								`Do you want to leave this game?\nPicking \`Nah\` ${futureTimestamp(
									SECONDS_TO_CONFIRM_LEAVE,
								)}`,
							),
					)),
					components: [
						new ActionRowBuilder<ButtonBuilder>().addComponents(
							new ButtonBuilder().setCustomId("yes").setLabel("Yeah").setStyle(ButtonStyle.Danger),
							new ButtonBuilder().setCustomId("no").setLabel("Nah").setStyle(ButtonStyle.Secondary),
						),
					],
					ephemeral: true,
					fetchReply: true,
				});
				let leaveConfirmationInteraction: ButtonInteraction;
				try {
					leaveConfirmationInteraction = await leaveConfirmation.awaitMessageComponent({
						componentType: ComponentType.Button,
						time: SECONDS_TO_CONFIRM_LEAVE * 1000,
					});
				} catch {
					return;
				}
				if (leaveConfirmationInteraction.customId === "no") {
					await interaction.deleteReply();
					return;
				}

				const player = this.players.get(interaction.member) as Player<false>;
				this.players.delete(interaction.member);
				await parallel(
					interaction.deleteReply(),
					this.playedAgain ? undefined : player.interaction.deleteReply(),
					this.updateMainMessage(),
				);
				return;
			}
			const p = this.addPlayer(interaction);
			p.roleMessage = (
				await parallel(
					interaction.reply({
						...(await p.roleEmbed()),
						ephemeral: true,
						fetchReply: true,
					}),
					this.updateMainMessage(),
				)
			)[0];
		});
		joinCollector.once("end", async (_, reason) => {
			if (reason !== "started") await this.abort();
			hostConfigCollector.stop("started");
			startedOnceSignal.fire();
		});
		await parallelRace(startedOnceSignal.promise, wait(SECONDS_TO_JOIN));
		if (this.aborted) return false;
	}

	private async decideTeams(this: Game<GameState.DecidingTeams>): Promise<boolean> {
		this.state = GameState.DecidingTeams;
		await this.updateMainMessage();
		const maxNumSeekers = Math.min(4, this.players.size - 1);
		const fairestNumSeekers = Math.floor(this.players.size / 2);
		const pickTeams = await this.hostConfigInteraction.editReply({
			embeds: [
				...(await this.host.roleEmbed()).embeds,
				...(
					await this.hostConfigEmbeds((b) =>
						b
							.setTitle("Decide teams")
							.setDescription(
								`Do you want me to pick the seekers for you or do you want to pick them manually?\nExpires ${futureTimestamp(
									SECONDS_TO_PICK_TEAMS,
								)}`,
							),
					)
				).embeds,
			],
			content: "",
			components: [
				...(this.playedAgain
					? [
							new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
								new StringSelectMenuBuilder()
									.setCustomId("rotate")
									.setPlaceholder("🔄 Rotate seekers...")
									.addOptions(
										fillArray(maxNumSeekers, (i) =>
											new StringSelectMenuOptionBuilder()
												.setLabel(
													`Rotate players and pick ${i + 1} seeker${i + 1 === 1 ? "" : "s"}${
														i + 1 === fairestNumSeekers ? " [FAIREST]" : ""
													}`,
												)
												.setValue(`${i + 1}`),
										),
									),
							),
						]
					: []),
				new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
					new StringSelectMenuBuilder()
						.setCustomId("random")
						.setPlaceholder("🎲 Pick number of random seekers...")
						.addOptions(
							fillArray(maxNumSeekers, (i) =>
								new StringSelectMenuOptionBuilder()
									.setLabel(
										`Pick ${i + 1} random seeker${i + 1 === 1 ? "" : "s"} for me${
											i + 1 === fairestNumSeekers ? " [FAIREST]" : ""
										}`,
									)
									.setValue(`${i + 1}`),
							),
						),
				),
				new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
					new StringSelectMenuBuilder()
						.setCustomId("manual")
						.setMaxValues(maxNumSeekers)
						.setMinValues(1)
						.setPlaceholder("*️⃣ Pick seekers manually...")
						.addOptions(
							this.players.map((v) =>
								new StringSelectMenuOptionBuilder()
									.setLabel(v.member.displayName)
									.setValue(v.member.id),
							),
						),
				),
				new ActionRowBuilder<ButtonBuilder>().addComponents(abortButton),
			],
		});
		const pickTeamsInteraction = (await pickTeams.awaitMessageComponent({
			time: SECONDS_TO_PICK_TEAMS * 1000,
		})) as StringSelectMenuInteraction | ButtonInteraction;
		await pickTeamsInteraction.deferUpdate();
		if (pickTeamsInteraction.customId === "rotate" && pickTeamsInteraction.isStringSelectMenu()) {
			// sorts seekers first
			// inverts and converts the role to a number so that Seeker = 1 and Hider = 0
			// the roles are never undefined here because this game has been "played again"
			this.players.sort((a, b) => +!b.role - +!a.role);

			// takes the first player from the collection and inserts them at the end
			const head = this.players.first()!;
			this.players.delete(head.member);
			this.players.set(head.member, head);

			const count = pickTeamsInteraction.isStringSelectMenu()
				? Number.parseInt(pickTeamsInteraction.values[0] ?? "-1")
				: fairestNumSeekers;
			let i = 0;
			// sets the first X players in the rotated players collection as seekers
			for (const v of this.players.values()) {
				v.role = i++ < count ? PlayerRole.Seeker : PlayerRole.Hider;
			}
		} else if (pickTeamsInteraction.customId === "random" && pickTeamsInteraction.isStringSelectMenu()) {
			const count = Number.parseInt(pickTeamsInteraction.values[0] ?? "-1");

			if (count === -1) {
				await this.abort();
				return false;
			}
			const seekerKeys = getRandomValues([...this.players.keys()], count);
			this.players.map((v, k) => {
				v.role = seekerKeys.includes(k) ? PlayerRole.Seeker : PlayerRole.Hider;
				this.players.set(k, v);
			});
		} else if (pickTeamsInteraction.customId === "manual" && pickTeamsInteraction.isStringSelectMenu())
			this.players.map((v, k) => {
				v.role = pickTeamsInteraction.values.includes(k.id) ? PlayerRole.Seeker : PlayerRole.Hider;
				this.players.set(k, v);
			});
		else {
			await this.abort();
			return false;
		}
		await parallel(
			this.players.map(async (v) => {
				if (v.isNotHost()) {
					if (this.playedAgain) {
						v.roleMessage = await v.interaction.followUp({ ...(await v.roleEmbed()), ephemeral: true });
					} else {
						await v.interaction.editReply(await v.roleEmbed());
					}
				}
			}),
		);
		return true;
	}
	private async awaitMatchStart(this: Game<GameState.WaitingForMatchStart>): Promise<"skip" | "abort" | undefined> {
		this.state = GameState.WaitingForMatchStart;
		await this.updateMainMessage();

		const waitForMatchMessage = await this.hostConfigInteraction.editReply({
			embeds: [
				...(await this.host.roleEmbed()).embeds,
				...(
					await this.hostConfigEmbeds((b) =>
						b
							.setTitle(`Waiting for match start... ${SQUID_SHUFFLE_EMOJI}`)
							.setDescription(
								'Press the `Match started!` button after the game says "Ready?" and "GO!"!',
							),
					)
				).embeds,
			],
			components: [
				new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder()
						.setLabel("Match started!")
						.setEmoji("✔️")
						.setCustomId("started")
						.setStyle(ButtonStyle.Success),
					new ButtonBuilder()
						.setLabel("I forgor")
						.setEmoji("💀")
						.setCustomId("skip")
						.setStyle(ButtonStyle.Secondary),
					abortButton,
				),
			],
		});
		const waitForMatchInteraction = await waitForMatchMessage.awaitMessageComponent({
			componentType: ComponentType.Button,
		});
		if (waitForMatchInteraction.customId === "abort") {
			await this.abort();
			return "abort";
		}
		if (waitForMatchInteraction.customId === "skip") {
			await waitForMatchInteraction.update({
				...(await embeds((b) => b.setTitle("You forgor..."))),
				components: [],
			});
			return "skip";
		}
		this.startedTime = new Date();
		await waitForMatchInteraction.update({
			embeds: [
				...(await this.host.roleEmbed()).embeds,
				...(
					await this.hostConfigEmbeds((b) =>
						b.setTitle(`Game started! ${BOOYAH_EMOJI}`).setDescription("Have fun!").setColor("Green"),
					)
				).embeds,
			],
			components: [],
		});
		this.startedMessage = await this.mainMessage.reply(
			`**The game has started! ${BOOYAH_EMOJI} Good luck everyone!** Hiding time ends ${futureTimestamp(
				this.hideTimeSeconds,
				this.startedTime,
			)} ${messageHiddenText(this.players.map((v) => userMention(v.member.id)).join(""))}`,
		);
	}
	private async hideTime(this: Game<GameState.HideTime>): Promise<void> {
		this.state = GameState.HideTime;
		await this.updateMainMessage();
		await wait(this.startedTime.getTime() / 1000 + this.hideTimeSeconds - Date.now() / 1000);
		if (this.startedMessage.deletable) await this.startedMessage.delete();
		this.hidingTimeUpMsg = await this.mainMessage.reply({
			content: `**⏰ Hiding time is up! The seekers will now go look for the hiders!** Match ends ${futureTimestamp(
				this.hideTimeSeconds + this.seekTimeSeconds,
				this.startedTime,
			)} ${messageHiddenText(this.players.map((v) => userMention(v.member.id)).join(""))}`,
		});
	}
	private async seekTime(this: Game<GameState.SeekTime>): Promise<void> {
		this.state = GameState.SeekTime;
		await this.updateMainMessage();

		await wait(this.startedTime.getTime() / 1000 + this.hideTimeSeconds + this.seekTimeSeconds - Date.now() / 1000);
		if (this.hidingTimeUpMsg.deletable) await this.hidingTimeUpMsg.delete();
	}
	public async playAgain(this: Game<GameState.PlayAgain>): Promise<boolean> {
		this.state = GameState.PlayAgain;
		await this.updateMainMessage();

		const playAgainMessage = await this.hostConfigInteraction.editReply({
			...(await this.hostConfigEmbeds((b) =>
				b
					.setTitle("Play again?")
					.setDescription(
						`Do you want to play again with the same players?\nPicking \`Nah\` ${futureTimestamp(
							SECONDS_TO_PLAY_AGAIN,
						)}`,
					),
			)),
			components: [
				new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder()
						.setCustomId("playAgain")
						.setLabel("Yeah!")
						.setEmoji("✔️")
						.setStyle(ButtonStyle.Success),
					new ButtonBuilder().setCustomId("no").setLabel("Nah").setEmoji("✖️").setStyle(ButtonStyle.Danger),
				),
			],
		});
		let playAgain = false;
		try {
			const i = await playAgainMessage.awaitMessageComponent({
				componentType: ComponentType.Button,
				time: SECONDS_TO_PLAY_AGAIN * 1000,
			});
			if (i.customId === "no") throw new Error("intermediate error");
			await i.deferUpdate();
			this.playedAgain = true;
			playAgain = true;
		} catch {
			playAgain = false;
		}
		await parallel(
			this.mainMessage.edit({
				...(await embeds((b) =>
					b.setTitle(`Hide and seek game finished ${VEEMO_PEEK_EMOJI}`).addFields(this.playerListField()),
				)),
			}),
			this.hostConfigInteraction.deleteReply(),
			...this.players.map(
				async (v) => !v.host && v.roleMessage && (await v.interaction.deleteReply(v.roleMessage)),
			),
		);
		return playAgain;
	}

	public async start() {
		while (true) {
			if ((await (this as Game).awaitPlayers()) === false) break;
			if (!(await (this as Game<GameState.DecidingTeams>).decideTeams())) break;
			const state = await (this as Game<GameState.WaitingForMatchStart>).awaitMatchStart();
			if (state === "abort") break;
			else if (state !== "skip") {
				await (this as Game<GameState.HideTime>).hideTime();
				await (this as Game<GameState.SeekTime>).seekTime();
			}
			if (!(await (this as Game<GameState.PlayAgain>).playAgain())) break;
		}
	}

	public async abort() {
		this.aborted = true;
		await parallel(
			this.mainMessage?.edit({
				...(await embeds((b) =>
					b
						.setTitle(`Hide and seek game was aborted :(`)
						.setDescription("The game was aborted...")
						.setColor("Red"),
				)),
				components: [],
			}),
			this.hostConfigInteraction?.deleteReply(),
			...this.players.toJSON().map(async (v) => {
				if (v.isNotHost() && !this.playedAgain) await v.interaction.deleteReply();
			}),
		);
	}
	public async updateMainMessage() {
		const parts: string[] = ["**Rules**", RULES, ""];
		switch (this.state) {
			case GameState.WaitingForPlayers:
				parts.push(`Expires ${futureTimestamp(SECONDS_TO_JOIN, this.createdTime)}`);
				break;
			case GameState.DecidingTeams:
				parts.push(`${SQUID_SHUFFLE_EMOJI} ${userMention(this.host.member.id)} is deciding teams...`);
				break;
			case GameState.WaitingForMatchStart:
				parts.push(`${SQUID_SHUFFLE_EMOJI} Waiting for the match to start...`);
				break;
			case GameState.HideTime:
				parts.push(`Hiding time ends ${futureTimestamp(this.hideTimeSeconds, this.startedTime)}`);
				break;
			case GameState.SeekTime:
				parts.push(
					`Match ends ${futureTimestamp(this.hideTimeSeconds + this.seekTimeSeconds, this.startedTime)}`,
				);
				break;
			case GameState.PlayAgain:
				parts.push(`Waiting for ${userMention(this.host.member.id)} to decide if we should play again...`);
				break;
		}
		await this.mainMessage?.edit({
			...(await embeds((b) =>
				b
					.setTitle(`Hide and seek! ${VEEMO_PEEK_EMOJI}`)
					.setDescription(parts.join("\n"))
					.addFields(this.playerListField()),
			)),
			...(this.state === GameState.WaitingForPlayers ? {} : { components: [] }),
		});
	}
}
