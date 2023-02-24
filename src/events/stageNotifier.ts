import axios from "axios";
import consola from "consola";
import type { TextChannel } from "discord.js";
import { AttachmentBuilder, EmbedBuilder, TimestampStyles } from "discord.js";
import sharp from "sharp";
import type { ScheduleClass, Schedules, Stage, VsRule } from "../apiTypes/schedules.js";
import { Mode, Rule } from "../apiTypes/schedules.js";
import type Client from "../client.js";
import { USER_AGENT } from "../client.js";
import database from "../database.js";
import type Event from "../event.js";
import { embeds } from "../utils.js";

// async function forceRequest() {
// 	const data = (await axios.get<Schedules>("https://splatoon3.ink/data/schedules.json")).data;
// 	await writeFile("./cached-schedules.txt", `${Date.now() + 1 * 60 * 1000}|${JSON.stringify(data)}`);
// 	return data;
// }

type ModeType = "Turf War" | "Anarchy Open" | "Anarchy Series" | "X Battle";

// const rankedModeMap = {
// 	[Rule.Area]: "<:SplatZones:1071477929969721474>",
// 	[Rule.Clam]: "<:ClamBlitz:1071477924764598313>",
// 	[Rule.Goal]: "<:Rainmaker:1071477926974992384>",
// 	[Rule.Loft]: "<:TowerControl:1071477928304578560>",
// 	[Rule.TurfWar]: "turfwar",
// } as Record<Rule, string>;

const modeIconMap = {
	"Turf War": "<:RegularBattle:1071473255841542176>",
	"Anarchy Series": "<:AnarchyBattle:1071472984793034753>",
	"Anarchy Open": "<:AnarchyBattle:1071472984793034753>",
	"X Battle": "<:XBattle:1071472975146131476>",
} as Record<ModeType, string>;

const modeColorMap = {
	"Turf War": "#CFF622",
	"Anarchy Series": "#F54910",
	"Anarchy Open": "#F54910",
	"X Battle": "#0FDB9B",
} as const satisfies Record<ModeType, string>;

const modeThumbnailMap = {
	[Rule.Area]: "https://cdn.wikimg.net/en/splatoonwiki/images/3/38/S3_icon_Splat_Zones.png",
	[Rule.Clam]: "https://cdn.wikimg.net/en/splatoonwiki/images/e/e3/S3_icon_Clam_Blitz.png",
	[Rule.Goal]: "https://cdn.wikimg.net/en/splatoonwiki/images/1/12/S3_icon_Rainmaker.png",
	[Rule.Loft]: "https://cdn.wikimg.net/en/splatoonwiki/images/b/bc/S3_icon_Tower_Control.png",
} as Record<Rule, string>;

async function stagesImage(vsStages: Stage[]): Promise<Buffer> {
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
		.composite(
			(
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
									dpi: 72 * 2.5,
									rgba: true,
								},
							})
								.blur(1)
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
									dpi: 72 * 2.5,
									rgba: true,
								},
							})
								.png()
								.toBuffer(),
						},
					]),
				)
			).flat(),
		)
		.png({ force: true })
		.toBuffer();
}

function modeEmbed(b: EmbedBuilder, mode: ModeType, index: string, vsRule: VsRule): EmbedBuilder {
	return (
		b
			.setTitle(`${modeIconMap[mode]} ${mode}`)
			//.setDescription(mode !== "Turf War" ? `${rankedModeMap[vsRule.rule]} ${vsRule.name}` : null)
			.setColor(modeColorMap[mode])
			.setThumbnail(modeThumbnailMap[vsRule.rule])
			.setImage(`attachment://${index.toString()}.png`)
	);
}

async function sendMatchRotation(
	client: Client<true>,
	currentNodeIndex: number,
	startTime: Date,
	endTime: Date,
	turfWar: ScheduleClass,
	ranked: ScheduleClass,
	xBattles: ScheduleClass,
) {
	const channel = (await client.channels.fetch(process.env["MAPS_CHANNEL_ID"]!)) as TextChannel;
	const [turfWarSetting, anarchySeriesSetting, anarchyOpenSetting, xBattlesSetting] = [
		turfWar.nodes[currentNodeIndex]?.regularMatchSetting,
		ranked.nodes[currentNodeIndex]?.bankaraMatchSettings?.find((v) => v.mode === Mode.Challenge),
		ranked.nodes[currentNodeIndex]?.bankaraMatchSettings?.find((v) => v.mode === Mode.Open),
		xBattles.nodes[currentNodeIndex]?.xMatchSetting,
	];
	if ([turfWarSetting, anarchySeriesSetting, anarchyOpenSetting, xBattlesSetting].findIndex((v) => !v) !== -1) return;
	const [turfWarImage, anarchySeriesImage, anarchyOpenImage, xBattlesImage] = [
		await stagesImage(turfWarSetting!.vsStages),
		await stagesImage(anarchySeriesSetting!.vsStages),
		await stagesImage(anarchyOpenSetting!.vsStages),
		await stagesImage(xBattlesSetting!.vsStages),
	];
	consola.log(
		[turfWarImage, anarchySeriesImage, anarchyOpenImage, xBattlesImage].map((v, i) =>
			new AttachmentBuilder(v).setName(i.toString() + ".png").toJSON(),
		),
	);
	consola.log(modeEmbed(new EmbedBuilder(), "Anarchy Series", "1", anarchySeriesSetting!.vsRule));
	const previousMessage = (await channel.messages.fetch({ limit: 1 })).first();
	if (previousMessage) await channel.messages.delete(previousMessage);
	await channel.send({
		...embeds(
			(b) =>
				b
					.setFooter({ text: "Data provided by splatoon3.ink" })
					.setTitle(
						`Splatoon 3 rotations\n<t:${Math.floor(startTime.getTime() / 1000)}:${
							TimestampStyles.LongDateTime
						}> -> <t:${Math.floor(endTime.getTime() / 1000)}:${TimestampStyles.LongDateTime}>`,
					)
					.setDescription(`Ends <t:${Math.floor(endTime.getTime() / 1000)}:${TimestampStyles.RelativeTime}>`),
			(b) => modeEmbed(b, "Turf War", "0", turfWarSetting!.vsRule),
			(b) => modeEmbed(b, "Anarchy Series", "1", anarchySeriesSetting!.vsRule),
			(b) => modeEmbed(b, "Anarchy Open", "2", anarchyOpenSetting!.vsRule),
			(b) => modeEmbed(b, "X Battle", "3", xBattlesSetting!.vsRule),
		),
		files: [turfWarImage, anarchySeriesImage, anarchyOpenImage, xBattlesImage].map((v, i) =>
			new AttachmentBuilder(v).setName(i.toString() + ".png"),
		),
	});
}

async function getAndSendMatchRotation(client: Client<true>) {
	const data = (
		await axios.get<Schedules>("https://splatoon3.ink/data/schedules.json", {
			headers: {
				"User-Agent": USER_AGENT,
			},
		})
	).data;

	const currentNodeIndex = data.data.regularSchedules.nodes.findIndex(
		(v) => new Date(Date.parse(v.endTime)) > new Date() && new Date(Date.parse(v.startTime)) < new Date(),
	);
	const endTime =
		data.data.regularSchedules.nodes[currentNodeIndex] &&
		new Date(Date.parse(data.data.regularSchedules.nodes[currentNodeIndex]!.endTime));
	const startTime =
		data.data.regularSchedules.nodes[currentNodeIndex] &&
		new Date(Date.parse(data.data.regularSchedules.nodes[currentNodeIndex]!.startTime));
	if (!endTime || !startTime) return;
	const {
		data: {
			regularSchedules: turfWar,
			bankaraSchedules: ranked,
			//coopGroupingSchedule: salmonRun,
			xSchedules: xBattles,
		},
	} = data;
	await sendMatchRotation(client, currentNodeIndex, startTime, endTime, turfWar, ranked, xBattles);
	return [startTime, endTime] as const;
}
async function loopSend(client: Client<true>) {
	const times = await getAndSendMatchRotation(client);
	if (!times) return;
	const [startTime, endTime] = times;
	await database.setLastSendMapRotation(startTime);
	setTimeout(() => {
		void loopSend(client);
	}, endTime.getTime() - new Date().getTime());
}

export default {
	event: "ready",

	async on({ client }) {
		// const cached = existsSync("./cached-schedules.txt")
		// 	? await readFile("./cached-schedules.txt", { encoding: "utf-8" })
		// 	: undefined;
		// const cacheExpiry = cached && parseInt(cached.split("|")[0]!);
		// let data: Schedules;
		// if (cached && cacheExpiry && cacheExpiry > Date.now()) {
		// 	data = JSON.parse(cached.split("|")[1]!) as Schedules;
		// } else {
		// 	data = await forceRequest();
		// }
		const timeTillSend = await database.timeTillNextMapRotationSend();
		if (timeTillSend > 0) {
			setTimeout(() => {
				void loopSend(client);
			}, timeTillSend);
		} else {
			void loopSend(client);
		}
	},
} as Event<"ready">;
