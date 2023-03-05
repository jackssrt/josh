import axios from "axios";
import type { EmbedBuilder, NewsChannel } from "discord.js";
import { AttachmentBuilder } from "discord.js";
import sharp from "sharp";
import type Client from "../client.js";
import { USER_AGENT } from "../client.js";
import database from "../database.js";
import type Event from "../event.js";
import type APIResponse from "../types/rotationNotifier.js";
import type {
	BankaraNode,
	BankaraSetting,
	RankedVsRule,
	RegularNode,
	RegularSetting,
	Stage,
	XNode,
	XSetting,
} from "../types/rotationNotifier.js";
import { embeds, relativeTimestamp, timeTimestamp, wait } from "../utils.js";

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
function extractSetting<T extends RotationType>(
	mode: T,
	data: RotationTypeToNodeType<T>,
): RegularSetting | BankaraSetting | XSetting {
	// typescript stupid moment (implied type is RegularSetting | XSetting AND (data as NodeType))
	return mode === "Turf War"
		? (data as RegularNode).regularMatchSetting
		: mode === "Anarchy Open" || mode === "Anarchy Series"
		? (data as BankaraNode).bankaraMatchSettings.find(
				(v) => v.mode === (mode === "Anarchy Series" ? "CHALLENGE" : "OPEN"),
		  )!
		: (data as XNode).xMatchSetting;
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

export async function sendRotations(client: Client<true>) {
	// get channel
	const channel = (await client.channels.fetch(process.env["MAPS_CHANNEL_ID"]!)) as NewsChannel;

	//delete previous message
	await (await channel.messages.fetch({ limit: 1 })).first()?.delete();

	// send api request
	const {
		data: {
			data: {
				regularSchedules: { nodes: turfWar },
				bankaraSchedules: { nodes: ranked },
				xSchedules: { nodes: xBattles },
			},
		},
	} = await axios.get<APIResponse>("https://splatoon3.ink/data/schedules.json", {
		headers: {
			"User-Agent": USER_AGENT,
		},
	});

	// fastforward to active nodes
	[turfWar, ranked, xBattles].forEach((v) => {
		if (v.length === 0) return;
		while (new Date(Date.parse(v[0]!.endTime)).getTime() < new Date().getTime()) {
			// first node has ended, remove it from the array
			v.shift();
			if (v.length === 0) return;
		}
	});
	// if any(isEmptyArray, turfWar, ranked, xBattles)
	if ([turfWar, ranked, xBattles].find((v) => v.length === 0) !== undefined) return;

	// get start time and end time
	const startTime = new Date(Date.parse(turfWar[0]!.startTime));
	const endTime = new Date(Date.parse(turfWar[0]!.endTime));

	// send message
	const attachments: AttachmentBuilder[] = [];
	const message = await channel.send({
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
				const [embed, attachment] = await makeEmbed(b, "X Battle", xBattles);
				attachments.push(attachment);
				return embed;
			},
		)),
		files: attachments,
	});

	// crosspost message
	await message.crosspost();
	return [startTime, endTime] as const;
}

async function loopSend(client: Client<true>) {
	// eslint-disable-next-line no-constant-condition
	while (true) {
		const times = await sendRotations(client);
		if (!times) return;
		const [startTime, endTime] = times;
		await database.setLastSendMapRotation(startTime);
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
