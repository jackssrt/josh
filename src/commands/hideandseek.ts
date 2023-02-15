import type { APIEmbedField, ButtonInteraction, ChatInputCommandInteraction, Message, User } from "discord.js";
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
import type Command from "../command.js";
import { embeds } from "../utils.js";

const OUCH_EMOJI = "<:ouch:1072282001396211882>";
const BOOYAH_EMOJI = "<:booyah:1072277912100806698>";
//const THISWAY_EMOJI = "<:thisway:1072283277093785721>";
const SQUIDSHUFFLE_EMOJI = "<a:squidShuffle:1072590626798960680>";

class Game {
	public players = new Collection<User, Player>();
	public host: Player<true>;

	constructor(private msg: Message, hostInteraction: ChatInputCommandInteraction) {
		const host = new Player(hostInteraction, true as const, undefined);
		this.players.set(hostInteraction.user, host);
		this.host = host;
	}

	public addPlayer(interaction: ButtonInteraction) {
		this.players.set(interaction.user, new Player(interaction, false as const, undefined));
	}

	public playerList(): string {
		return this.players
			.map(
				(v) =>
					`${
						v.isHost
							? "👑"
							: v.role === PlayerRole.Hider
							? "🥸"
							: v.role === PlayerRole.Seeker
							? "🏃"
							: "👤"
					} - ${v.user.username}`,
			)
			.join("\n");
	}
	public playerListField(): APIEmbedField {
		return { name: "👥 Player list", value: this.playerList() };
	}

	public async decideTeams() {
		await this.msg.edit({
			...embeds((b) =>
				b
					.setTitle("Setup")
					.setDescription(`${userMention(this.host.user.id)} is deciding teams... ${SQUIDSHUFFLE_EMOJI}`)
					.addFields(this.playerListField()),
			),
			components: [],
		});
		const maxSeekers = Math.min(4, this.players.size - 1);
		await this.host.interaction.followUp({
			...embeds((b) =>
				b
					.setTitle("Decide teams")
					.setDescription("Do you want me to pick the seekers for you or do you want to pick them manually?"),
			),
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
			ephemeral: true,
		});
	}
	public async abort() {
		await this.msg.edit({
			...embeds((b) =>
				b
					.setTitle(`Hide and seek game was aborted ${OUCH_EMOJI}`)
					.setDescription("The game was aborted...")
					.setColor("Red"),
			),
			components: [],
		});
	}
	public async updateMainMessage() {
		await this.msg.edit({
			...embeds((b) =>
				b.setTitle("Hide and seek!").setDescription("Rules here").addFields(this.playerListField()),
			),
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
	data: (b) => b.setDescription("Starts a hide and seek game!"),
	async execute({ interaction }) {
		const msg = await interaction.reply({
			...embeds((b) => b.setTitle(`Hide and seek!`).setDescription("Rules here")),
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
		const quickStart = await interaction.followUp({
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
		quickStart
			.createMessageComponentCollector({
				componentType: ComponentType.Button,
				max: 1,
				filter: async (x) => {
					await x.deferUpdate();
					return true;
				},
			})
			.on("collect", async (i) => {
				if (i.customId === "quickStart") {
					//pass
				} else {
					quickStart.deletable && quickStart.delete();
					await i.editReply({ content: "The game was aborted.", components: [] });
					await game.abort();
				}
			});
		const game = new Game(msg, interaction);
		await game.updateMainMessage();
		const collector = msg.createMessageComponentCollector({
			componentType: ComponentType.Button,
			maxUsers: 7,
			time: 10 * 1000,
			filter: (x) =>
				x.user.id === interaction.user.id
					? void x.reply({ content: "You're the host!", ephemeral: true }) || false
					: game.players.find((y) => y.user.id === x.user.id)
					? void x.reply("You've already joined!") || false
					: void x.reply({ content: `Joined! ${BOOYAH_EMOJI}`, ephemeral: true }) || true,
		});
		collector.on("collect", async (collected) => {
			game.addPlayer(collected);
			await game.updateMainMessage();
		});
		collector.once("end", async (collected) => {
			if (collected.size < 1)
				return void (await msg.edit({
					...embeds((b) => b.setTitle(`Too few players joined ${OUCH_EMOJI}`)),
					components: [],
				}));

			await game.decideTeams();
		});
	},
} as Command;
