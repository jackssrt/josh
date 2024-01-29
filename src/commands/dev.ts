import type { VoiceChannel } from "discord.js";
import {
	AttachmentBuilder,
	ChannelType,
	Collection,
	GuildMember,
	GuildScheduledEventEntityType,
	GuildScheduledEventPrivacyLevel,
	PermissionsBitField,
	Role,
	TimestampStyles,
	userMention,
} from "discord.js";
import sharp from "sharp";
import { P, match } from "ts-pattern";
import { USER_AGENT } from "../client.js";
import database from "../database.js";
import { reportSchemaFail } from "../errorhandler.js";
import { makeChallengeEvents } from "../events/challengeEvent.js";
import { updateChannelName, updateChannels } from "../events/expandingVoiceChannels.js";
import { onMemberJoin, onMemberLeave } from "../events/joinLeave.js";
import { updateRoleCategories } from "../events/roleCategories.js";
import { updateStatsMessage } from "../events/statsMessage.js";
import rotations from "../rotations/index.js";
import * as FestivalsAPI from "../schemas/festivalsApi.js";
import { colorLuminance, hexToRGB } from "../utils/color.js";
import { request } from "../utils/http.js";
import { textImage } from "../utils/image.js";
import { parallel } from "../utils/promise.js";
import { pluralize } from "../utils/string.js";
import createCommand from "./../command.js";
import { COLOR_DATA } from "./color.js";

type Subcommand =
	| "forcerotations"
	| "mapsandmodesrotation"
	| "salmonrunrotation"
	| "rolecategories"
	| "colorrolesimage"
	| "memberjoin"
	| "memberleave"
	| "splatfest"
	| "stats"
	| "challenges"
	| "cancelallevents"
	| "setinvite"
	| "expandingvoicechannels"
	| "renamevoicechannels";

async function makeColorRolesImage() {
	const CELL_SIZE = [200, 100] as const;
	const COLOR_DATA_LEN_SQRT = Math.sqrt(COLOR_DATA.length);
	const IMAGE_SIZE_IN_CELLS = [Math.ceil(COLOR_DATA_LEN_SQRT), Math.floor(COLOR_DATA_LEN_SQRT)] as const;
	return await sharp({
		create: {
			width: CELL_SIZE[0] * IMAGE_SIZE_IN_CELLS[0],
			height: CELL_SIZE[1] * IMAGE_SIZE_IN_CELLS[1],
			background: "#00000000",
			channels: 4,
		},
	})
		.composite(
			await parallel(
				COLOR_DATA.map(async (v, i) => {
					return {
						input: await sharp({
							create: {
								width: CELL_SIZE[0],
								height: CELL_SIZE[1],
								background: `#${v.value}`,
								channels: 3,
							},
						})
							.composite([
								{
									input: await (
										await textImage(
											v.name,
											colorLuminance(...hexToRGB(`#${v.value}`)) > 255 / 2 ? "black" : "white",
											2,
										)
									).toBuffer(),
								},
							])
							.png()
							.toBuffer(),
						left: Math.floor(i / IMAGE_SIZE_IN_CELLS[1]) * CELL_SIZE[0],
						top: (i % IMAGE_SIZE_IN_CELLS[1]) * CELL_SIZE[1],
					};
				}),
			),
		)
		.png()
		.toBuffer();
}

export default createCommand({
	data: (b) =>
		b
			.addSubcommand((b) => b.setName("forcerotations").setDescription("Force fetch new rotations"))
			.addSubcommand((b) => b.setName("mapsandmodesrotation").setDescription("Rerun maps and modes rotation"))
			.addSubcommand((b) => b.setName("salmonrunrotation").setDescription("Rerun salmon run rotation"))
			.addSubcommand((b) =>
				b
					.setName("rolecategories")
					.setDescription("Rerun role categories")
					.addMentionableOption((b) => b.setName("users").setDescription("User(s)").setRequired(true)),
			)
			.addSubcommand((b) => b.setName("colorrolesimage").setDescription("Generate color roles image"))
			.addSubcommand((b) =>
				b
					.setName("memberjoin")
					.setDescription("Rerun member join")
					.addUserOption((b) => b.setName("member").setDescription("member").setRequired(true)),
			)
			.addSubcommand((b) =>
				b
					.setName("memberleave")
					.setDescription("Rerun member leave")
					.addUserOption((b) => b.setName("member").setDescription("member").setRequired(true)),
			)
			.addSubcommand((b) => b.setName("stats").setDescription("Rerun stats"))
			.addSubcommand((b) =>
				b
					.setName("setinvite")
					.setDescription("Sets who invited someone")
					.addUserOption((b) =>
						b.setName("inviter").setDescription("The person who invited someone").setRequired(true),
					)
					.addUserOption((b) =>
						b.setName("invitee").setDescription("The person who got invited").setRequired(true),
					),
			)
			.addSubcommand((b) => b.setName("splatfest").setDescription("Rerun splatfest"))
			.addSubcommand((b) =>
				b
					.setName("challenges")
					.setDescription("Rerun challenges")
					.addBooleanOption((b) =>
						b.setName("overridedatabase").setDescription("Override database?").setRequired(false),
					),
			)
			.addSubcommand((b) => b.setName("cancelallevents").setDescription("Cancel all events"))
			.addSubcommand((b) => b.setName("expandingvoicechannels").setDescription("Reruns expanding voice channels"))
			.addSubcommand((b) => b.setName("renamevoicechannels").setDescription("Rename voice channels"))
			.setDescription("developer only command")
			.setDMPermission(false)
			.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
	ownerOnly: true,
	defer: "ephemeral",
	async execute({ interaction, client }) {
		if (!interaction.inCachedGuild()) return;
		await match(interaction.options.getSubcommand() as Subcommand)
			.with("forcerotations", async () => {
				await rotations.forceUpdate();
				await interaction.editReply("done");
			})
			.with(P.select(P.union("mapsandmodesrotation", "salmonrunrotation")), async (subcommand) => {
				if (subcommand === "mapsandmodesrotation") await rotations.notifyChanged();
				else await rotations.notifySalmonChanged();
				await interaction.editReply("done");
			})
			.with("rolecategories", async () => {
				const mentionable = interaction.options.getMentionable("users", true);
				const users =
					mentionable instanceof Role
						? mentionable.members
						: mentionable instanceof GuildMember
							? new Collection([[mentionable.id, mentionable]])
							: undefined;
				if (!users) return await interaction.editReply("no users passed in");
				await parallel(
					// typescript stupid moment
					(
						users.map as (
							fn: (
								value: GuildMember,
								key: string,
								collection: Collection<string, GuildMember>,
							) => Promise<void>,
						) => Promise<void>[]
					)(async (v) => await updateRoleCategories(v)),
				);
				await interaction.editReply(`done, affected ${users.size} ${pluralize("member", users.size)}`);
			})
			.with("colorrolesimage", async () => {
				await interaction.editReply({
					content: `done:`,
					files: [new AttachmentBuilder(await makeColorRolesImage()).setName("color-roles.png")],
				});
			})
			.with(P.select(P.union("memberjoin", "memberleave")), async (subcommand) => {
				const member = interaction.options.getMember("member");

				if (
					!(member instanceof GuildMember) ||
					member.user.bot ||
					member.guild !== client.guild ||
					process.env.JOIN_IGNORE_IDS.split(",").includes(member.id)
				)
					return;
				if (subcommand === "memberjoin") await onMemberJoin(client, member);
				else await onMemberLeave(client, member);
				await interaction.editReply("done");
			})
			.with("stats", async () => {
				await updateStatsMessage(client);
				await interaction.editReply("done");
			})
			.with("setinvite", async () => {
				const inviter = interaction.options.getUser("inviter", true).id;
				const invitee = interaction.options.getUser("invitee", true).id;
				await database.setInviteRecord(inviter, invitee);
				await updateStatsMessage(client);
				await interaction.editReply(`done, ${userMention(inviter)} => ${userMention(invitee)}`);
			})
			.with("splatfest", async () => {
				const response = (
					await request("https://splatoon3.ink/data/festivals.json", {
						headers: {
							"User-Agent": USER_AGENT,
						},
					})
				).expect("Failed to fetch splatfests.");
				const validationResult = FestivalsAPI.responseSchema.safeParse(response);
				if (!validationResult.success)
					reportSchemaFail(
						"Festivals",
						`FestivalsAPI.responseSchema.safeParse(response)`,
						validationResult.error,
					);
				const data = validationResult.success ? validationResult.data : (response as FestivalsAPI.Response);
				const fest = data.US.data.festRecords.nodes.find((v) => v.state !== "CLOSED");
				if (!fest) return await interaction.editReply("No active splatfest");
				await parallel(
					async () => {
						await client.guild.scheduledEvents.create({
							entityType: GuildScheduledEventEntityType.External,
							name: fest.title,
							privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
							scheduledStartTime: new Date(Date.parse(fest.startTime)),
							scheduledEndTime: new Date(Date.parse(fest.endTime)),
							entityMetadata: { location: "Splatoon 3" },
							image: fest.image.url,
							description: `Automatically created event for the upcoming splatfest.\n<t:${Math.floor(
								new Date(Date.parse(fest.startTime)).getTime() / 1000,
							)}:${TimestampStyles.RelativeTime}>\nData provided by https://splatoon3.ink`,
						});
					},
					async () => {
						for (const team of fest.teams) {
							await client.guild.roles.create({
								name: `⚽・${team.teamName}`,
								color: [team.color.r * 255, team.color.g * 255, team.color.b * 255],
								permissions: [],
								mentionable: false,
								position: client.splatfestTeamRoleCategory.position,
							});
						}
					},
				);
				await interaction.editReply("done");
			})
			.with("challenges", async () => {
				await makeChallengeEvents(
					interaction.guild,
					interaction.options.getBoolean("overridedatabase", false) ?? false,
				);
				await interaction.editReply("done");
			})
			.with("cancelallevents", async () => {
				await parallel(
					interaction.guild.scheduledEvents.cache.map((v) => interaction.guild.scheduledEvents.delete(v)),
				);
				await interaction.editReply("done");
			})
			.with("expandingvoicechannels", async () => {
				await updateChannels(client.voiceCategory, client.unusedVoiceCategory);
				await interaction.editReply("done");
			})
			.with("renamevoicechannels", async () => {
				const result = await parallel(
					...[
						...client.voiceCategory.children.cache
							.filter((v): v is VoiceChannel => v.type === ChannelType.GuildVoice)
							.sort((a, b) => a.position - b.position)
							.values(),
					].map(async (v, i) => {
						await updateChannelName(v, i + 1);
					}),
					...[
						...client.unusedVoiceCategory.children.cache
							.filter((v): v is VoiceChannel => v.type === ChannelType.GuildVoice)
							.sort((a, b) => a.position - b.position)
							.values(),
					].map(async (v, i) => {
						await updateChannelName(v, i + 1 + client.voiceCategory.children.cache.size);
					}),
				);
				await interaction.editReply(`done, renamed ${result.length} ${pluralize("channel", result.length)}`);
			})
			.otherwise(async () => await interaction.editReply("unimplemented"));
	},
});
