import axios from "axios";
import dedent from "dedent";
import type { Client, EmbedBuilder, NewsChannel, TextChannel } from "discord.js";
import { AttachmentBuilder } from "discord.js";
import sharp from "sharp";
import { USER_AGENT } from "../client.js";
import database from "../database.js";
import { ANARCHY_BATTLE_EMOJI, REGULAR_BATTLE_EMOJI, X_BATTLE_EMOJI } from "../emojis.js";
import type Event from "../event.js";
import type SchedulesApiResponse from "../types/rotationNotifier.js";
import type {
	BankaraNode,
	BankaraSetting,
	CoopGroupingRegularNode,
	RankedVsRule,
	RegularNode,
	RegularSetting,
	Stage,
	XNode,
	XSetting,
} from "../types/rotationNotifier.js";
import { dateTimestamp, embeds, relativeTimestamp, shortenStageName, timeTimestamp, wait } from "../utils.js";
type RotationType = "Turf War" | "Anarchy Open" | "Anarchy Series" | "X Battle";

const EMBED_DATA_MAP = {
	"Turf War": {
		emoji: "<:regularBattle:1071473255841542176>",
		color: "#CFF622",
	},
	"Anarchy Series": {
		emoji: "<:anarchyBattle:1071472984793034753>",
		color: "#F54910",
	},
	"Anarchy Open": {
		emoji: "<:anarchyBattle:1071472984793034753>",
		color: "#F54910",
	},
	"X Battle": {
		emoji: "<:xBattle:1071472975146131476>",
		color: "#0FDB9B",
	},
} as const satisfies Record<RotationType, unknown>;

const RANKED_MODE_DATA_MAP = {
	AREA: {
		image: "https://cdn.wikimg.net/en/splatoonwiki/images/3/38/S3_icon_Splat_Zones.png",
		emoji: "<:splatZones:1071477929969721474>",
	},
	CLAM: {
		image: "https://cdn.wikimg.net/en/splatoonwiki/images/e/e3/S3_icon_Clam_Blitz.png",
		emoji: "<:clamBlitz:1071477924764598313>",
	},
	GOAL: {
		image: "https://cdn.wikimg.net/en/splatoonwiki/images/1/12/S3_icon_Rainmaker.png",
		emoji: "<:rainmaker:1071477926974992384>",
	},
	LOFT: {
		image: "https://cdn.wikimg.net/en/splatoonwiki/images/b/bc/S3_icon_Tower_Control.png",
		emoji: "<:towerControl:1071477928304578560>",
	},
} as const satisfies Record<RankedVsRule["rule"], unknown>;

async function makeEmbedImage(vsStages: Stage[]) {
	const images = await Promise.all(
		vsStages.map(
			async (v) =>
				[
					v,
					sharp(
						Buffer.from(
							(
								await axios.get<ArrayBuffer>(v.image.url, {
									responseType: "arraybuffer",
									headers: {
										"User-Agent": USER_AGENT,
									},
								})
							).data,
						),
					),
				] as const,
		),
	);
	return await sharp({
		create: {
			width: 400 * images.length,
			height: 200,
			background: "#00000000",
			channels: 4,
		},
	})
		.composite([
			...(
				await Promise.all(
					images.map<Promise<sharp.OverlayOptions[]>>(async (v, i) => [
						{
							input: await v[1].toBuffer(),
							left: 400 * i,
							top: 0,
						},
						{
							left: 400 * i + 8 + 2,
							top: 8 + 2,
							input: await sharp({
								text: {
									text: `<span foreground="black">${v[0].name}</span>`,
									font: "Splatoon2",
									dpi: 72 * 3,
									rgba: true,
								},
							})
								.png()
								.toBuffer(),
						},
						{
							top: 0,
							left: 400 * i,
							input: await sharp({
								create: {
									background: "#000000AA",
									channels: 4,
									height: 32 + 8 * 2,
									width: 400,
								},
							})
								.png()
								.toBuffer(),
						},
						{
							left: 400 * i + 8,
							top: 8,
							input: await sharp({
								text: {
									text: `<span foreground="white">${v[0].name}</span>`,
									font: "Splatoon2",
									dpi: 72 * 3,
									rgba: true,
								},
							})
								.png()
								.toBuffer(),
						},
					]),
				)
			).flat(),
		])
		.png({ force: true })
		.toBuffer();
}
type RotationTypeToNodeType<T extends RotationType> = T extends "Turf War"
	? RegularNode
	: T extends "Anarchy Open" | "Anarchy Series"
	? BankaraNode
	: XNode;
type RotationTypeToSettingType<T extends RotationType> = T extends "Turf War"
	? RegularSetting
	: T extends "Anarchy Open"
	? BankaraSetting<"OPEN">
	: T extends "Anarchy Series"
	? BankaraSetting<"CHALLENGE">
	: XSetting;
function extractSetting<T extends RotationType>(
	mode: T,
	data: RotationTypeToNodeType<T>,
): RotationTypeToSettingType<T> {
	// typescript stupid moment (implied type is RegularSetting | XSetting AND (data as NodeType))
	return (
		mode === "Turf War"
			? (data as RegularNode).regularMatchSetting
			: mode === "Anarchy Open" || mode === "Anarchy Series"
			? (data as BankaraNode).bankaraMatchSettings.find(
					(v) => v.mode === (mode === "Anarchy Series" ? "CHALLENGE" : "OPEN"),
			  )!
			: (data as XNode).xMatchSetting
	) as RotationTypeToSettingType<T>;
}

async function makeEmbed<T extends RotationType>(
	b: EmbedBuilder,
	mode: T,
	data: RotationTypeToNodeType<T>[],
): Promise<[EmbedBuilder, AttachmentBuilder]> {
	const { emoji, color } = EMBED_DATA_MAP[mode];
	const setting = extractSetting(mode, data[0]!);
	// limit next rotations to 3
	data = data.slice(1, 4);
	const { image } = setting.vsRule.rule !== "TURF_WAR" ? RANKED_MODE_DATA_MAP[setting.vsRule.rule] : { image: null };
	return [
		b
			.setTitle(`${emoji} ${mode}`)
			.setDescription(
				data
					.reduce((a, v) => {
						const nextSetting = extractSetting(mode, v);
						if (mode === "Turf War") return `${a} ➔ ${nextSetting.vsStages.map((v) => v.name).join(" & ")}`;
						const { emoji } = RANKED_MODE_DATA_MAP[nextSetting.vsRule.rule as RankedVsRule["rule"]];
						return `${a} ➔ ${emoji} ${nextSetting.vsRule.name}`;
					}, "")
					.trimStart(),
			)
			.setThumbnail(image)
			.setColor(color)
			.setImage(`attachment://${mode.replace(" ", "-")}.png`),
		new AttachmentBuilder(await makeEmbedImage(setting.vsStages)).setName(`${mode.replace(" ", "-")}.png`),
	];
}

function generateChannelTopic(endTime: Date, turfWar: RegularNode[], ranked: BankaraNode[], xBattle: XNode[]): string {
	const turfWarSetting = extractSetting("Turf War", turfWar[0]!);
	const seriesSetting = extractSetting("Anarchy Series", ranked[0]!);
	const openSetting = extractSetting("Anarchy Open", ranked[0]!);
	const xSetting = extractSetting("X Battle", xBattle[0]!);
	const parts = [
		`Next ${relativeTimestamp(endTime)}`,
		`${REGULAR_BATTLE_EMOJI} ${turfWarSetting.vsStages.map((v) => `[${shortenStageName(v.name)}]`).join(" & ")}`,
		`${ANARCHY_BATTLE_EMOJI} **Series** [${RANKED_MODE_DATA_MAP[seriesSetting.vsRule.rule].emoji} ${
			seriesSetting.vsRule.name
		}]`,
		`${ANARCHY_BATTLE_EMOJI} **Open** [${RANKED_MODE_DATA_MAP[openSetting.vsRule.rule].emoji} ${
			openSetting.vsRule.name
		}]`,
		`${X_BATTLE_EMOJI} [${RANKED_MODE_DATA_MAP[xSetting.vsRule.rule].emoji} ${xSetting.vsRule.name}]`,
	];
	return parts.join(`\n・\n`);
}
const TEXT_BLUR_SIGMA = 1.00005;
async function makeSalmonRunImage(salmon: CoopGroupingRegularNode) {
	const WIDTH = 800;
	const HEIGHT = 600;
	const ICON_SIZE = HEIGHT - 450 - 16;
	return await sharp({ create: { width: WIDTH, height: HEIGHT, background: "#00000000", channels: 4 } })
		.composite([
			...(
				await Promise.all(
					salmon.setting.weapons.map<Promise<sharp.OverlayOptions[]>>(async (v, i) => {
						// adding "Dg" forces the text image to be as tall as possible,
						// thus making all weapon names align.
						const nameImage = sharp({
							text: {
								text: `<span foreground="white">Dg ${v.name} Dg</span>`,
								font: "Splatoon2",
								dpi: 72 * 2,
								rgba: true,
							},
						});
						const nameImageWidth = ((await nameImage.metadata()).width ?? 28 * 2) - 28 * 2;

						const nameImageHeight = (await nameImage.metadata()).height ?? 0;
						// cuts off the "Dg" text while keeping the height
						// and extra horizontal space for the blur to look good
						nameImage.resize(nameImageWidth, nameImageHeight);

						return [
							{
								input: await sharp(
									Buffer.from(
										(
											await axios.get<ArrayBuffer>(v.image.url, {
												responseType: "arraybuffer",
												headers: { "User-Agent": USER_AGENT },
											})
										).data,
									),
								)
									.resize(ICON_SIZE, ICON_SIZE)
									.toBuffer(),
								left: (WIDTH / 4) * i + WIDTH / 4 / 2 - ICON_SIZE / 2,
								top: (HEIGHT - 450) / 2 + 450 - 10 - ICON_SIZE / 2,
							},
							{
								input: await nameImage.blur(TEXT_BLUR_SIGMA).png().toBuffer(),

								top: Math.round(HEIGHT - nameImageHeight),
								left: Math.round((WIDTH / 4) * i + WIDTH / 4 / 2 - nameImageWidth / 2),
							},
						];
					}),
				)
			).flat(),
			...(await Promise.all(
				new Array(salmon.setting.weapons.length - 1)
					.fill(false)
					.map<Promise<sharp.OverlayOptions>>(async (_, i) => ({
						input: await sharp({
							create: {
								background: "#ffffff80",
								channels: 4,
								height: HEIGHT - 450 - 16 - 32 - 16,
								width: 2,
							},
						})
							.png()
							.toBuffer(),
						top: 450 + 16 + 16 + 8,
						left: (WIDTH / 4) * (i + 1) - 1,
					})),
			)),
			{
				input: await sharp(
					Buffer.from(
						(
							await axios.get<ArrayBuffer>(salmon.setting.coopStage.image.url, {
								responseType: "arraybuffer",
							})
						).data,
					),
				)
					.composite([
						{
							input: Buffer.from(`<svg><rect x="0" y="0" width="800" height="450" rx="8" ry="8"/></svg>`),
							blend: "dest-in",
						},
					])
					.png()
					.toBuffer(),
				left: 0,
				top: 0,
			},
		])
		.png()
		.toBuffer();
}
export async function makeSalmonRunGearImage() {
	const gear = await database.activeMonthlySalmonRunGear();
	// adding "Dg" forces the text image to be as tall as possible,
	// thus making the text have a constant height
	const nameImage = sharp({
		text: {
			text: `<span foreground="white">Dg ${gear.name} Dg</span>`,
			font: "Splatoon2",
			dpi: 72 * 3.5,
			rgba: true,
		},
	});
	const nameImageWidth = ((await nameImage.metadata()).width ?? 28 * 2 * 1.75) - 28 * 2 * 1.75;

	const nameImageHeight = (await nameImage.metadata()).height ?? 0;
	// cuts off the "Dg" text while keeping the height
	// and extra horizontal space for the blur to look good
	nameImage.resize(nameImageWidth, nameImageHeight);
	return await sharp({ create: { width: 256, height: 256, background: "#00000000", channels: 4 } })
		.composite([
			{
				input: Buffer.from(
					(
						await axios.get<ArrayBuffer>(gear.image, {
							headers: { "User-Agent": USER_AGENT },
							responseType: "arraybuffer",
						})
					).data,
				),
				left: 0,
				top: 0,
			},
			{
				input: await nameImage.blur(TEXT_BLUR_SIGMA).png().toBuffer(),
				left: Math.round(256 / 2 - nameImageWidth / 2),
				top: Math.round(256 - nameImageHeight),
			},
		])
		.png()
		.toBuffer();
}

export async function sendSalmonRunRotation(
	client: Client<true>,
	salmonStartTime: Date,
	salmonEndTime: Date,
	salmonNodes: CoopGroupingRegularNode[],
) {
	// get channel
	const salmonRunChannel = (await client.channels.fetch(process.env["SALMON_RUN_CHANNEL_ID"]!)) as NewsChannel;

	// delete previous message
	await (await salmonRunChannel.messages.fetch({ limit: 1 })).first()?.delete();

	const currentNode = salmonNodes[0]!;

	// limit next rotations to 3
	salmonNodes = salmonNodes.slice(1, 4);

	// send message
	const message = await salmonRunChannel.send({
		...(await embeds((b) =>
			b
				.setAuthor({ name: "Data provided by splatoon3.ink", url: "https://splatoon3.ink/" })
				.setTitle("Splatoon 3 Salmon Run rotation")
				.setDescription(
					dedent`Started ${relativeTimestamp(salmonStartTime)}\nEnds ${relativeTimestamp(
						salmonEndTime,
					)} @ ${dateTimestamp(salmonEndTime)} ${timeTimestamp(salmonEndTime, false)}`,
				)
				.addFields({
					name: "Next rotations",
					value: salmonNodes
						.reduce(
							(acc, v) =>
								`${acc}➔ ${v.setting.weapons.map((v) => v.name).join(" & ")} @ ${
									v.setting.coopStage.name
								}\n`,
							"",
						)
						.trimEnd(),
				})
				.setThumbnail("attachment://gear.png")
				.setImage("attachment://salmonrun.png"),
		)),
		files: [
			new AttachmentBuilder(await makeSalmonRunImage(currentNode)).setName("salmonrun.png"),
			new AttachmentBuilder(await makeSalmonRunGearImage()).setName("gear.png"),
		],
	});

	// crosspost message
	await message.crosspost();
}
export async function sendRegularRotations(
	client: Client<true>,
	endTime: Date,
	turfWar: RegularNode[],
	ranked: BankaraNode[],
	xBattle: XNode[],
) {
	// get channels
	const mapsChannel = (await client.channels.fetch(process.env["MAPS_CHANNEL_ID"]!)) as NewsChannel;
	const generalChannel = (await client.channels.fetch(process.env["GENERAL_CHANNEL_ID"]!)) as TextChannel;

	// delete previous message
	await (await mapsChannel.messages.fetch({ limit: 1 })).first()?.delete();
	await Promise.all([
		// set channel topic

		generalChannel.setTopic(generateChannelTopic(endTime, turfWar, ranked, xBattle)),

		async () => {
			// send message
			const attachments: AttachmentBuilder[] = [];
			const message = await mapsChannel.send({
				...(await embeds(
					(b) =>
						b
							.setAuthor({ name: "Data provided by splatoon3.ink", url: "https://splatoon3.ink/" })
							.setTitle(`Splatoon 3 maps and modes rotations`)
							.setDescription(`Ends ${relativeTimestamp(endTime)} @ ${timeTimestamp(endTime, false)}`),
					async (b) => {
						const [embed, attachment] = await makeEmbed(b, "Turf War", turfWar);
						attachments.push(attachment);
						return embed;
					},
					async (b) => {
						const [embed, attachment] = await makeEmbed(b, "Anarchy Series", ranked);
						attachments.push(attachment);
						return embed;
					},
					async (b) => {
						const [embed, attachment] = await makeEmbed(b, "Anarchy Open", ranked);
						attachments.push(attachment);
						return embed;
					},
					async (b) => {
						const [embed, attachment] = await makeEmbed(b, "X Battle", xBattle);
						attachments.push(attachment);
						return embed;
					},
				)),
				files: attachments,
			});
			// crosspost message
			await message.crosspost();
		},
	]);
}

export async function fetchRotations() {
	// send api request
	const {
		data: {
			data: {
				regularSchedules: { nodes: turfWar },
				bankaraSchedules: { nodes: ranked },
				xSchedules: { nodes: xBattle },
				coopGroupingSchedule: {
					regularSchedules: { nodes: salmon },
				},
			},
		},
	} = await axios.get<SchedulesApiResponse>("https://splatoon3.ink/data/schedules.json", {
		headers: {
			"User-Agent": USER_AGENT,
		},
	});

	// fastforward to active nodes
	[turfWar, ranked, xBattle, salmon].forEach((v) => {
		if (v.length === 0) return;
		while (new Date(Date.parse(v[0]!.endTime)).getTime() < new Date().getTime()) {
			// first node has ended, remove it from the array
			v.shift();
			if (v.length === 0) return;
		}
	});
	// if any(isEmptyArray, turfWar, ranked, xBattles)
	if ([turfWar, ranked, xBattle, salmon].find((v) => v.length === 0) !== undefined) return;

	// get start time and end time
	const startTime = new Date(Date.parse(turfWar[0]!.startTime));
	const endTime = new Date(Date.parse(turfWar[0]!.endTime));
	const salmonStartTime = new Date(Date.parse(salmon[0]!.startTime));
	const salmonEndTime = new Date(Date.parse(salmon[0]!.endTime));

	return { startTime, endTime, turfWar, ranked, xBattle, salmonStartTime, salmonEndTime, salmon } as const;
}

async function loopSend(client: Client<true>) {
	// eslint-disable-next-line no-constant-condition
	while (true) {
		const output = await fetchRotations();
		if (!output) return;
		const { endTime, turfWar, ranked, xBattle, salmonStartTime, salmonEndTime, salmon } = output;
		await Promise.all([
			async () => {
				await sendRegularRotations(client, endTime, turfWar, ranked, xBattle);
				await database.setNextMapRotation(endTime);
			},
			(await database.shouldSendSalmonRunRotation())
				? async () => {
						await sendSalmonRunRotation(client, salmonStartTime, salmonEndTime, salmon);
						await database.setNextSalmonRunRotation(salmonEndTime);
				  }
				: Promise.resolve(),
		]);

		await wait((endTime.getTime() - new Date().getTime()) / 1000);
	}
}

export default {
	event: "ready",
	async on({ client }) {
		const timeTillSend = await database.timeTillNextMapRotationSend();
		if (timeTillSend > 0) await wait(timeTillSend / 1000);
		await loopSend(client);
	},
} as Event<"ready">;
