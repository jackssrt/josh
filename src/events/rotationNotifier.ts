import axios from "axios";
import consola from "consola";
import type { Client, EmbedBuilder, NewsChannel, TextChannel } from "discord.js";
import { AttachmentBuilder, TimestampStyles, time } from "discord.js";
import sharp from "sharp";
import { USER_AGENT } from "../client.js";
import type { DatabaseData } from "../database.js";
import database from "../database.js";
import {
	ANARCHY_BATTLE_EMOJI,
	COHOZUNA_EMOJI,
	HORRORBOROS_EMOJI,
	REGULAR_BATTLE_EMOJI,
	SPLATFEST_EMOJI,
	X_BATTLE_EMOJI,
} from "../emojis.js";
import getEnv from "../env.js";
import type Event from "../event.js";
import type { RotationType } from "../maps.js";
import { GAME_MODE_MAP, ROTATION_TYPE_MAP } from "../maps.js";
import type SchedulesApiResponse from "../types/rotationNotifier.js";
import type {
	BankaraNode,
	BankaraSetting,
	BaseCoopRegularSetting,
	CoopGroupingRegularNode,
	CoopRegularStage,
	CurrentFest,
	FestNode,
	FestSetting,
	RegularNode,
	RegularSetting,
	Stage,
	TeamContestNode,
	XNode,
	XSetting,
} from "../types/rotationNotifier.js";
import type { StrictExclude } from "../utils.js";
import { dedent, embeds, formatTime, parallel, shortenStageName, wait } from "../utils.js";
const SALMON_RUN_STAGE_EMOJI_MAP = {
	"Spawning Grounds": "<:spawningGrounds:1087077105638047764>",
	"Sockeye Station": "<:sockeyeStation:1087077104274911292>",
	"Marooner's Bay": "<:maroonersBay:1087077102559432894>",
	"Gone Fission Hydroplant": "<:goneFissionHydroplant:1087077100294516750>",
} as const satisfies Record<CoopRegularStage["name"], string>;

async function makeEmbedImage(vsStages: Stage[]) {
	const images = await parallel(
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
					).resize(400, 200 - 8, { fit: sharp.fit.cover }),
				] as const,
		),
	);
	return await sharp({
		create: {
			width: 400 * images.length,
			height: 200 - 8,
			background: "#00000000",
			channels: 4,
		},
	})
		.composite([
			...(
				await parallel(
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
export type RotationTypeToNodeType<T extends RotationType> = T extends "turfwar"
	? RegularNode
	: T extends "anarchyopen" | "anarchyseries"
	? BankaraNode
	: T extends "splatfest"
	? FestNode
	: T extends "xbattle"
	? XNode
	: never;
export type RotationTypeToSettingType<T extends RotationType> = T extends "turfwar"
	? RegularSetting
	: T extends "anarchyopen"
	? BankaraSetting<"OPEN">
	: T extends "anarchyseries"
	? BankaraSetting<"CHALLENGE">
	: T extends "splatfest"
	? FestSetting
	: T extends "xbattle"
	? XSetting
	: never;
export function extractSetting<T extends StrictExclude<RotationType, "tricolor">>(
	mode: T,
	data: RotationTypeToNodeType<T>,
): RotationTypeToSettingType<T> | null {
	// typescript stupid moment (implied type is RegularSetting | XSetting | null | undefined AND (data as NodeType))
	return (
		mode === "turfwar"
			? (data as RegularNode).regularMatchSetting
			: mode === "anarchyopen" || mode === "anarchyseries"
			? (data as BankaraNode).bankaraMatchSettings?.find(
					(v) => v.mode === (mode === "anarchyseries" ? "CHALLENGE" : "OPEN"),
			  )
			: mode === "splatfest"
			? (data as FestNode).festMatchSetting
			: (data as XNode).xMatchSetting
	) as RotationTypeToSettingType<T> | null;
}

export function makeCompactRotationText<T extends StrictExclude<RotationType, "tricolor">>(
	mode: T,
	data: RotationTypeToNodeType<T>,
	includeDate: boolean,
): string | undefined {
	const startTime = new Date(Date.parse(data.startTime));
	const setting = extractSetting(mode, data);
	const isNow = new Date(Date.parse(data.startTime)).getTime() < new Date().getTime();
	return setting
		? `${isNow ? "**" : ""}${
				setting.vsRule.rule === "TURF_WAR"
					? setting.vsStages.map((v) => shortenStageName(v.name)).join(" & ")
					: `${GAME_MODE_MAP[setting.vsRule.rule].emoji} ${setting.vsRule.name}`
		  } @ ${time(startTime, TimestampStyles.ShortTime)}${
				includeDate ? ` ${time(startTime, TimestampStyles.ShortDate)}` : ""
		  }${isNow ? " [now]**" : ` [${time(startTime, TimestampStyles.RelativeTime)}]`}`
		: undefined;
}

export function makeCompactSalmonRunRotationText(salmon: CoopGroupingRegularNode): string {
	const startTime = new Date(Date.parse(salmon.startTime));
	const isNow = startTime.getTime() < new Date().getTime();
	return dedent`${isNow ? "**" : ""}${SALMON_RUN_STAGE_EMOJI_MAP[salmon.setting.coopStage.name]} ${
		salmon.setting.coopStage.name
	} @ ${time(startTime, TimestampStyles.ShortTime)} ${time(startTime, TimestampStyles.ShortDate)}${
		isNow ? " [now]**" : ` [${time(startTime, TimestampStyles.RelativeTime)}]`
	}
	${salmon.setting.weapons.map((v) => `**${v.name}**`).join(" & ")}`;
}

async function makeEmbed<T extends RotationType>(
	b: EmbedBuilder,
	mode: T,
	data: T extends "tricolor" ? CurrentFest<"SECOND_HALF"> : RotationTypeToNodeType<T>[],
): Promise<[EmbedBuilder, AttachmentBuilder] | undefined> {
	const { emoji, color } = ROTATION_TYPE_MAP[mode];
	if (mode === "tricolor")
		return [
			b
				.setTitle(`${emoji} ${mode}`)
				.setColor(color)
				.setImage(`attachment://${mode.replace(" ", "-")}.png`),
			new AttachmentBuilder(await makeEmbedImage([(data as CurrentFest<"SECOND_HALF">).tricolorStage])).setName(
				`${mode.replace(" ", "-")}.png`,
			),
		];
	const setting = extractSetting(mode, (data as RotationTypeToNodeType<T>[])[0]!);
	if (!setting) return;
	// limit next rotations to 3
	const newData = (data as RotationTypeToNodeType<T>[]).slice(1, 4);
	const { image } = setting.vsRule.rule !== "TURF_WAR" ? GAME_MODE_MAP[setting.vsRule.rule] : { image: null };
	return [
		b
			.setTitle(`${emoji} ${mode === "splatfest" ? "Splatfest Open & Pro" : mode}`)
			.setDescription(
				newData
					.reduce((acc, v) => {
						const text = makeCompactRotationText(mode, v, false);
						if (!text) return acc;
						return `${acc}\n➔ ${text}`;
					}, "")
					.trimStart() || null,
			)
			.setThumbnail(image)
			.setColor(color)
			.setImage(`attachment://${mode.replace(" ", "-")}.png`),
		new AttachmentBuilder(await makeEmbedImage(setting.vsStages)).setName(`${mode.replace(" ", "-")}.png`),
	];
}

function generateChannelTopic(
	endTime: Date,
	currentFest: CurrentFest<"FIRST_HALF" | "SECOND_HALF"> | undefined,
	splatfest: FestNode[],
	turfWar: RegularNode[],
	ranked: BankaraNode[],
	xBattle: XNode[],
): string {
	const splatfestSetting = extractSetting("splatfest", splatfest[0]!);
	const nextSplatfestSetting = splatfest[1] && extractSetting("splatfest", splatfest[1]);

	const turfWarSetting = extractSetting("turfwar", turfWar[0]!);

	const seriesSetting = extractSetting("anarchyseries", ranked[0]!);
	const nextSeriesSetting = ranked[1] && extractSetting("anarchyseries", ranked[1]);

	const openSetting = extractSetting("anarchyopen", ranked[0]!);
	const nextOpenSetting = ranked[1] && extractSetting("anarchyopen", ranked[1]);

	const xSetting = extractSetting("xbattle", xBattle[0]!);
	const nextXSetting = xBattle[1] && extractSetting("xbattle", xBattle[1]);

	const parts = [
		`Next ${time(endTime, TimestampStyles.RelativeTime)}`,
		splatfestSetting &&
			`${SPLATFEST_EMOJI} **Open & Pro** ${splatfestSetting.vsStages
				.map((v) => `[${shortenStageName(v.name)}]`)
				.join(" & ")}${
				nextSplatfestSetting
					? ` ➔ ${nextSplatfestSetting.vsStages.map((v) => `[${shortenStageName(v.name)}]`).join(" & ")}`
					: ""
			}`,
		currentFest?.state === "SECOND_HALF" &&
			`${SPLATFEST_EMOJI} **Tricolor** [${shortenStageName(currentFest.tricolorStage.name)}]`,
		turfWarSetting &&
			`${REGULAR_BATTLE_EMOJI} ${turfWarSetting.vsStages
				.map((v) => `[${shortenStageName(v.name)}]`)
				.join(" & ")}`,
		seriesSetting &&
			`${ANARCHY_BATTLE_EMOJI} **Series** [${GAME_MODE_MAP[seriesSetting.vsRule.rule].emoji} ${
				seriesSetting.vsRule.name
			}${nextSeriesSetting ? ` ➔ ${GAME_MODE_MAP[nextSeriesSetting.vsRule.rule].emoji}` : ""}]`,
		openSetting &&
			`${ANARCHY_BATTLE_EMOJI} **Open** [${GAME_MODE_MAP[openSetting.vsRule.rule].emoji} ${
				openSetting.vsRule.name
			}${nextOpenSetting ? ` ➔ ${GAME_MODE_MAP[nextOpenSetting.vsRule.rule].emoji}` : ""}]`,
		xSetting &&
			`${X_BATTLE_EMOJI} [${GAME_MODE_MAP[xSetting.vsRule.rule].emoji} ${xSetting.vsRule.name}${
				nextXSetting ? ` ➔ ${GAME_MODE_MAP[nextXSetting.vsRule.rule].emoji}` : ""
			}]`,
	];
	// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
	return parts.flatMap((v) => v || []).join(`\n・\n`);
}
const TEXT_BLUR_SIGMA = 1.00005;
async function makeSalmonRunImage(salmon: BaseCoopRegularSetting) {
	const WIDTH = 800;
	const HEIGHT = 600;
	const ICON_SIZE = HEIGHT - 450 - 16;
	return await sharp({ create: { width: WIDTH, height: HEIGHT, background: "#00000000", channels: 4 } })
		.composite([
			...(
				await parallel(
					salmon.weapons.map<Promise<sharp.OverlayOptions[]>>(async (v, i) => {
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
			...(await parallel(
				new Array(salmon.weapons.length - 1).fill(false).map<Promise<sharp.OverlayOptions>>(async (_, i) => ({
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
							await axios.get<ArrayBuffer>(salmon.coopStage.image.url, {
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
export async function makeSalmonRunThumbnail(gear: DatabaseData["monthlySalmonRunGear"]) {
	// adding "Dg" forces the text image to be as tall as possible,
	// thus making the text have a constant height
	/*const nameImage = sharp({
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
	nameImage.resize(nameImageWidth, nameImageHeight);*/
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
			/*{
				input: await nameImage.blur(TEXT_BLUR_SIGMA).png().toBuffer(),
				left: Math.round(256 / 2 - nameImageWidth / 2),
				top: Math.round(256 - nameImageHeight),
			}*/
		])
		.png()
		.toBuffer();
}

export async function sendSalmonRunRotation(
	client: Client<true>,
	salmonStartTime: Date,
	salmonEndTime: Date,
	salmonNodes: CoopGroupingRegularNode[],
	eggstraWorkNodes: TeamContestNode[],
) {
	// get channel
	const salmonRunChannel = (await client.channels.fetch(getEnv("SALMON_RUN_CHANNEL_ID"))) as NewsChannel;

	// delete previous message
	await (await salmonRunChannel.messages.fetch({ limit: 1 })).first()?.delete();

	const currentSalmonNode = salmonNodes[0]!;
	const gear = await database.activeMonthlySalmonRunGear();

	// limit next rotations to 3
	salmonNodes = salmonNodes.slice(1, 4);

	const eggstraWork = eggstraWorkNodes[0];
	const eggstraWorkStart = eggstraWork && new Date(Date.parse(eggstraWork.startTime));
	const eggstraWorkEnd = eggstraWork && new Date(Date.parse(eggstraWork.endTime));
	// send message
	const message = await salmonRunChannel.send({
		...(await embeds(
			(b) =>
				b
					.setAuthor({ name: "Data provided by splatoon3.ink", url: "https://splatoon3.ink/" })
					.setTitle("Splatoon 3 Salmon Run rotation")
					.setDescription(
						dedent`Started ${time(salmonStartTime, TimestampStyles.RelativeTime)}\nEnds ${time(
							salmonEndTime,
							TimestampStyles.RelativeTime,
						)} @ ${time(salmonEndTime, TimestampStyles.ShortDate)} ${time(
							salmonEndTime,
							TimestampStyles.ShortTime,
						)}`,
					)
					.addFields(
						{
							name: "King salmonid",
							value: `${
								currentSalmonNode.__splatoon3ink_king_salmonid_guess === "Horrorboros"
									? HORRORBOROS_EMOJI
									: COHOZUNA_EMOJI
							} ${currentSalmonNode.__splatoon3ink_king_salmonid_guess}`,
							inline: true,
						},
						{ name: "Monthly gear", value: gear.name, inline: true },
						{
							name: "Next rotations",
							value: salmonNodes
								.reduce(
									(acc, v) =>
										dedent`${acc}

								➔ ${makeCompactSalmonRunRotationText(v)}`,
									"",
								)
								.trimStart(),
						},
					)
					.setThumbnail("attachment://gear.png")
					.setImage("attachment://salmonrun.png")
					.setColor("#ff5033"),
			(b) =>
				eggstraWork &&
				eggstraWorkStart &&
				eggstraWorkEnd &&
				b
					.setTitle("Eggstra work")
					.setDescription(
						`Started ${time(eggstraWorkStart, TimestampStyles.RelativeTime)} @ ${time(
							eggstraWorkStart,
							TimestampStyles.ShortDate,
						)} ${time(eggstraWorkStart, TimestampStyles.ShortTime)}\nEnds ${time(
							eggstraWorkEnd,
							TimestampStyles.RelativeTime,
						)} @ ${time(eggstraWorkEnd, TimestampStyles.ShortDate)} ${time(
							eggstraWorkEnd,
							TimestampStyles.ShortTime,
						)}`,
					)
					.setImage("attachment://eggstrawork.png")
					.setColor("#FDD400"),
		)),
		files: await parallel(
			async () =>
				new AttachmentBuilder(await makeSalmonRunImage(currentSalmonNode.setting)).setName("salmonrun.png"),
			async () => new AttachmentBuilder(await makeSalmonRunThumbnail(gear)).setName("gear.png"),
			...(eggstraWork
				? [
						async () =>
							new AttachmentBuilder(await makeSalmonRunImage(eggstraWork.setting)).setName(
								"eggstrawork.png",
							),
				  ]
				: []),
		),
	});

	// crosspost message
	await message.crosspost();
}
export async function sendRegularRotations(
	client: Client<true>,
	endTime: Date,
	currentFest: CurrentFest<"FIRST_HALF" | "SECOND_HALF"> | undefined,
	splatfest: FestNode[],
	turfWar: RegularNode[],
	ranked: BankaraNode[],
	xBattle: XNode[],
) {
	// get channels
	const mapsChannel = (await client.channels.fetch(getEnv("MAPS_CHANNEL_ID"))) as NewsChannel;
	const generalChannel = (await client.channels.fetch(getEnv("GENERAL_CHANNEL_ID"))) as TextChannel;

	// delete previous message
	await (await mapsChannel.messages.fetch({ limit: 1 })).first()?.delete();
	await parallel(
		// set channel topic
		generalChannel.setTopic(generateChannelTopic(endTime, currentFest, splatfest, turfWar, ranked, xBattle)),

		async () => {
			// send message
			const attachments: AttachmentBuilder[] = [];
			async function makeEmbedAndAddImage<T extends RotationType>(
				b: EmbedBuilder,
				mode: T,
				nodes: T extends "tricolor" ? CurrentFest<"SECOND_HALF"> : RotationTypeToNodeType<T>[],
			): Promise<EmbedBuilder | undefined> {
				const data = await makeEmbed(b, mode, nodes);
				if (!data) return;
				attachments.push(data[1]);
				return data[0];
			}
			const message = await mapsChannel.send({
				...(await embeds(
					(b) =>
						b
							.setAuthor({ name: "Data provided by splatoon3.ink", url: "https://splatoon3.ink/" })
							.setTitle(`Splatoon 3 maps and modes rotations`)
							.setDescription(
								`Ends ${time(endTime, TimestampStyles.RelativeTime)} @ ${time(
									endTime,
									TimestampStyles.ShortTime,
								)}`,
							),
					async (b) => await makeEmbedAndAddImage(b, "splatfest", splatfest),
					async (b) =>
						currentFest?.state === "SECOND_HALF" &&
						(await makeEmbedAndAddImage(b, "tricolor", currentFest as CurrentFest<"SECOND_HALF">)),
					async (b) => await makeEmbedAndAddImage(b, "turfwar", turfWar),
					async (b) => await makeEmbedAndAddImage(b, "anarchyseries", ranked),
					async (b) => await makeEmbedAndAddImage(b, "anarchyopen", ranked),
					async (b) => await makeEmbedAndAddImage(b, "xbattle", xBattle),
				)),
				files: attachments,
			});
			// crosspost message
			await message.crosspost();
		},
	);
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
					teamContestSchedules: { nodes: eggstraWork },
				},
				festSchedules: { nodes: splatfest },
				currentFest,
			},
		},
	} = await axios.get<SchedulesApiResponse>("https://splatoon3.ink/data/schedules.json", {
		headers: {
			"User-Agent": USER_AGENT,
		},
	});

	// fastforward to active nodes
	[turfWar, ranked, xBattle, salmon, splatfest, eggstraWork].forEach((v) => {
		if (v.length === 0) return;
		while (new Date(Date.parse(v[0]!.endTime)).getTime() < new Date().getTime()) {
			// first node has ended, remove it from the array
			v.shift();
			if (v.length === 0) return;
		}
	});
	// if any(isEmptyArray, turfWar, ranked, xBattles)
	if ([turfWar, ranked, xBattle, salmon].find((v) => v.length === 0) !== undefined) {
		consola.warn("A schedule was empty!");
		return undefined;
	}

	// get start time and end time
	const startTime = new Date(Date.parse(turfWar[0]!.startTime));
	const endTime = new Date(Date.parse(turfWar[0]!.endTime));
	const salmonStartTime = new Date(Date.parse(salmon[0]!.startTime));
	const salmonEndTime = new Date(Date.parse(salmon[0]!.endTime));

	return {
		startTime,
		endTime,
		splatfest,
		turfWar,
		ranked,
		xBattle,
		salmonStartTime,
		salmonEndTime,
		salmon,
		eggstraWork,
		currentFest: currentFest ?? undefined,
	} as const;
}

async function loopSend(client: Client<true>) {
	// eslint-disable-next-line no-constant-condition, @typescript-eslint/no-unnecessary-condition
	while (true) {
		const output = await fetchRotations();
		if (!output) return;
		const {
			endTime,
			splatfest,
			turfWar,
			ranked,
			xBattle,
			salmonStartTime,
			salmonEndTime,
			salmon,
			currentFest,
			eggstraWork,
		} = output;
		await parallel(
			async () => {
				consola.info("Sending regular rotations...");
				await database.setNextMapRotation(endTime);
				await sendRegularRotations(
					client,
					endTime,
					currentFest ?? undefined,
					splatfest,
					turfWar,
					ranked,
					xBattle,
				);
			},
			(await database.shouldSendSalmonRunRotation()) &&
				(async () => {
					consola.info("Sending salmon run rotations...");
					await database.setNextSalmonRunRotation(salmonEndTime);

					await sendSalmonRunRotation(client, salmonStartTime, salmonEndTime, salmon, eggstraWork);
				}),
		);

		await wait((endTime.getTime() - new Date().getTime()) / 1000);
	}
}

export default {
	event: "ready",
	async on({ client }) {
		const timeTillSend = await database.timeTillNextMapRotationSend();
		consola.info(`Time till next rotation send: ${formatTime(timeTillSend / 1000)}`);
		if (timeTillSend > 0) await wait(timeTillSend / 1000);
		await loopSend(client);
	},
} as Event<"ready">;
