// due to inheritance I have to use async functions without awaiting anything in them
/* eslint-disable @typescript-eslint/require-await */
import axios from "axios";
import type { EmbedBuilder, HexColorString } from "discord.js";
import { AttachmentBuilder, TimestampStyles, time } from "discord.js";
import type { Sharp } from "sharp";
import sharp from "sharp";
import { match } from "ts-pattern";
import type { z } from "zod";
import { USER_AGENT } from "../client.js";
import {
	ANARCHY_BATTLE_EMOJI,
	CHALLENGES_EMOJI,
	COHOZUNA_EMOJI,
	HORRORBOROS_EMOJI,
	MEGALODONTIA_EMOJI,
	REGULAR_BATTLE_EMOJI,
	SPLATFEST_EMOJI,
	X_BATTLE_EMOJI,
} from "../emojis.js";
import type * as CommonAPI from "../types/common.js";
import type * as SchedulesAPI from "../types/schedulesApi.js";
import { dedent, fillArrayAsync, parallel, textImage } from "../utils.js";
import TimePeriod from "./TimePeriod.js";
import TimePeriodCollection from "./TimePeriodCollection.js";
import { Rotations } from "./index.js";
import type { APIRuleToRule, Rule } from "./rules.js";
import { RULE_MAP, turfWarRule } from "./rules.js";
import type { BaseCoopStage } from "./stages.js";
import { CoopStage, Stage, TricolorStage } from "./stages.js";

interface Shortable {
	short: () => string[][];
}

interface BaseNodeShortOptions {
	showDate: boolean;
}
export abstract class BaseNode extends TimePeriod implements Shortable {
	public abstract color: HexColorString;
	public abstract emoji: string;
	public abstract name: string;
	public get imageName() {
		return this.name.toLowerCase().replace(/&/g, "and").replace(/ /g, "_");
	}

	constructor(data: CommonAPI.BaseNode) {
		super(data.startTime, data.endTime);
	}
	public short(options?: BaseNodeShortOptions | undefined) {
		const parts: string[][] = [
			[time(this.startTime, TimestampStyles.RelativeTime), time(this.startTime, TimestampStyles.ShortTime)],
		];
		if (this.startTime.getDay() !== new Date().getDay() && options?.showDate)
			parts[0]!.push(time(this.startTime, TimestampStyles.ShortDate));
		return parts;
	}
	public abstract notificationText(): string;
	public abstract embed(b: EmbedBuilder, future: readonly (this | undefined)[]): Promise<EmbedBuilder>;
	public abstract images(width: number, height: number): Promise<Sharp[]>;
	public abstract attachments(): Promise<AttachmentBuilder[]>;
}

export abstract class DisplayableMatchNode extends BaseNode {
	public abstract rule: Rule;
	public abstract stages: (Stage | TricolorStage)[];
	public override short(options?: BaseNodeShortOptions | undefined) {
		return [
			[
				`${this.started ? "**" : ""}${
					!(this.rule.rule === "TURF_WAR") ? `${this.rule.emoji} ` : ""
				}${this.stages.map((v) => v.short()).join(", ")}${this.started ? "**" : ""} ${super
					.short(options)
					.map((v) => v.join(" "))
					.join("\n")}`,
			],
		];
	}
	public channelTopicLabel: string | undefined = undefined;
	public channelTopic(future: DisplayableMatchNode | undefined) {
		const parts: string[] = [this.emoji];
		if (this.channelTopicLabel) parts.push(`**${this.channelTopicLabel}**`);
		parts.push(":");
		if (this.rule.rule === "TURF_WAR") parts.push(this.stages.map((v) => v.short()).join(", "));
		else parts.push(this.rule.emoji, this.rule.name);
		if (future && future.rule.rule !== "TURF_WAR") {
			parts.push("➔");
			parts.push(future.rule.emoji);
		}
		return parts.join(" ");
	}
	public notificationText() {
		const parts: string[] = [`${this.name}:`];
		if (this.rule.rule === "TURF_WAR") parts.push(this.stages.map((v) => v.short()).join(", "));
		else parts.push(this.rule.name);
		return parts.join(" ");
	}

	public async embed(b: EmbedBuilder, future: readonly (DisplayableMatchNode | undefined)[]): Promise<EmbedBuilder> {
		return b
			.setTitle(`${this.emoji} ${this.name}`)
			.setDescription(this.embedDescription(future) || null)
			.setThumbnail(this.rule.rule === "TURF_WAR" ? null : this.rule.image)
			.setColor(this.color)
			.setImage(`attachment://${this.imageName}.png`);
	}
	public embedDescription(future: readonly (DisplayableMatchNode | undefined)[]): string {
		return future
			.flatMap((v) =>
				v
					? v
							.short()
							.map((v) => v.join(" "))
							.join("\n")
					: [],
			)
			.join("\n");
	}

	public async images(
		width: number,
		height: number,
		context: "challengesEvent" | "rotationNotifier" = "rotationNotifier",
	): Promise<[Sharp]> {
		const stageWidth = Math.ceil(width / this.stages.length);
		const images = await parallel(
			this.stages.map(async (v) => {
				return [
					v,
					sharp(
						Buffer.from(
							(
								await axios.get<ArrayBuffer>(v.image, {
									responseType: "arraybuffer",
									headers: {
										"User-Agent": USER_AGENT,
									},
								})
							).data,
						),
					).resize(stageWidth, height, { fit: sharp.fit.cover }),
				] as const;
			}),
		);
		return [
			sharp({
				create: {
					width,
					height,
					background: "#00000000",
					channels: 4,
				},
			})
				.composite([
					...(
						await parallel(
							images.map<Promise<sharp.OverlayOptions[]>>(async (v, i) => {
								const [text, shadowText] = await parallel(
									textImage(v[0].name, "white", 6),
									textImage(v[0].name, "black", 6),
								);
								return [
									{
										input: await v[1].toBuffer(),
										left: stageWidth * i,
										top: 0,
									},
									...(context !== "challengesEvent"
										? [
												{
													top: 0,
													left: stageWidth * i,
													input: await (() =>
														sharp({
															create: {
																background: "#000000AA",
																width: stageWidth,
																height: 16 + ((await text.metadata()).height ?? 20) + 8,
																channels: 4,
															},
														})
															.png()
															.toBuffer())(),
												},
												{
													left: stageWidth * i + 16 + 4,
													top: 16 + 4,
													input: await shadowText.toBuffer(),
												},
												{
													left: stageWidth * i + 16,
													top: 16,
													input: await text.toBuffer(),
												},
										  ]
										: []),
									...(context === "challengesEvent"
										? [
												{
													top: height / 2 - height / 2 / 2,
													left: width / 2 - height / 2 / 2,
													input: await (() =>
														sharp("./assets/challenges.png")
															.resize({ width: height / 2, height: height / 2 })
															.toBuffer())(),
												},
										  ]
										: []),
								];
							}),
						)
					).flat(),
				])
				.png({ force: true }),
		];
	}
	public async attachments(): Promise<AttachmentBuilder[]> {
		return [
			new AttachmentBuilder((await this.images(this.stages.length * 800, 450))[0]).setName(
				`${this.imageName}.png`,
			),
		];
	}
}

export abstract class BaseMatchNode<
	VsRule extends SchedulesAPI.VsRule,
	NodeType extends CommonAPI.BaseNode,
	SettingType extends SchedulesAPI.BaseMatchSetting,
> extends DisplayableMatchNode {
	public rule: APIRuleToRule<VsRule>;
	public stages: [Stage, Stage];

	constructor(data: NodeType, setting: SettingType, vsStages: SchedulesAPI.HighImageQualityStage[]) {
		super(data);
		this.stages = setting.vsStages.map((v) => new Stage(v, vsStages)) as [Stage, Stage];
		this.rule = RULE_MAP[setting.vsRule.rule] as APIRuleToRule<VsRule>;
	}
}

export class TurfWarNode extends BaseMatchNode<
	SchedulesAPI.TurfWarVsRule,
	SchedulesAPI.TurfWarNode,
	SchedulesAPI.TurfWarSetting
> {
	public color = "#CFF622" as const;
	public emoji = REGULAR_BATTLE_EMOJI;
	public name = "Turf War" as const;
}
export class RankedOpenNode extends BaseMatchNode<
	SchedulesAPI.RankedVsRule,
	SchedulesAPI.RankedNode,
	SchedulesAPI.RankedSetting<"OPEN">
> {
	public color = "#F54910" as const;
	public emoji = ANARCHY_BATTLE_EMOJI;
	public name = "Anarchy Open" as const;
	public override channelTopicLabel = "Open";
}
export class RankedSeriesNode extends BaseMatchNode<
	SchedulesAPI.RankedVsRule,
	SchedulesAPI.RankedNode,
	SchedulesAPI.RankedSetting<"CHALLENGE">
> {
	public color = "#F54910" as const;
	public emoji = ANARCHY_BATTLE_EMOJI;
	public name = "Anarchy Series" as const;
	public override channelTopicLabel = "Series";
}
export class XBattleNode extends BaseMatchNode<
	SchedulesAPI.RankedVsRule,
	SchedulesAPI.XBattleNode,
	SchedulesAPI.XBattleSetting
> {
	public color = "#0FDB9B" as const;
	public emoji = X_BATTLE_EMOJI;
	public name = "X Battle" as const;
}
export class ChallengeNode extends BaseMatchNode<
	SchedulesAPI.VsRule,
	SchedulesAPI.ChallengeNode & CommonAPI.BaseNode,
	SchedulesAPI.ChallengeSetting
> {
	public color = "#F02D7D" as const;
	public emoji = CHALLENGES_EMOJI;
	public name = "Challenges" as const;
	public timePeriods: TimePeriodCollection<ChallengeTimePeriod>;
	/**
	 * @example "NewSeasonCup"
	 * @example "SpecialRush_UltraShot"
	 */
	public leagueId: string;
	/**
	 * @example "New Season Challenge"
	 * @example "Too Many Trizookas!"
	 */
	public challengeName: string;
	/**
	 * @example "Celebrate the new season on a new stage!"
	 */
	public shortDescription: string;
	/**
	 * @example "Compete on a perfectly level playing field—everyone will be trying out a new stage together!\n\n・ Develop stage-specific strategies and tactics in real time.\n"
	 */
	public longDescription: string;
	/**
	 * @example "TGVhZ3VlTWF0Y2hFdmVudC1OZXdTZWFzb25DdXA="
	 */
	public id: string;
	constructor(
		data: SchedulesAPI.ChallengeNode,
		setting: SchedulesAPI.ChallengeSetting,
		vsStages: SchedulesAPI.HighImageQualityStage[],
	) {
		const timePeriods = data.timePeriods.map((v) => new ChallengeTimePeriod(v));
		const startTime = timePeriods.map((v) => v.startTime).sort((a, b) => a.getTime() - b.getTime())[0]!;
		const endTime = timePeriods.map((v) => v.endTime).sort((a, b) => b.getTime() - a.getTime())[0]!;

		super({ startTime: startTime.toISOString(), endTime: endTime.toISOString(), ...data }, setting, vsStages);
		this.timePeriods = new TimePeriodCollection(timePeriods);

		const { leagueMatchEventId, name, desc, regulation, id } = setting.leagueMatchEvent;
		this.leagueId = leagueMatchEventId;
		this.challengeName = name;
		this.shortDescription = desc;
		this.longDescription = regulation.replace(/<br \/>/g, "\n");
		this.id = id;
	}
	public override embedDescription(): string {
		return this.timePeriods
			.future(3)
			.flatMap((v) =>
				v.future
					? v
							.short()
							.map((v) => v.join(" "))
							.join("\n")
					: [],
			)
			.join("\n");
	}
}
export class ChallengeTimePeriod extends TimePeriod implements Shortable {
	constructor(data: SchedulesAPI.ChallengeTimePeriod) {
		super(data.startTime, data.endTime);
	}
	public short(): string[][] {
		return [
			[
				time(this.startTime, TimestampStyles.RelativeTime),
				time(this.startTime, TimestampStyles.ShortDate),
				time(this.startTime, TimestampStyles.ShortTime),
				"→",
				time(this.endTime, TimestampStyles.ShortTime),
			],
		];
	}
}

export class SplatfestOpenNode extends BaseMatchNode<
	SchedulesAPI.TurfWarVsRule,
	SchedulesAPI.FestNode,
	SchedulesAPI.FestSetting<"REGULAR">
> {
	public color = "#0033FF" as const;
	public emoji = SPLATFEST_EMOJI;
	public name = "Splatfest Open" as const;
	public override channelTopicLabel = "Open";
}

export class SplatfestProNode extends BaseMatchNode<
	SchedulesAPI.TurfWarVsRule,
	SchedulesAPI.FestNode,
	SchedulesAPI.FestSetting<"CHALLENGE">
> {
	public color = "#0033FF" as const;
	public emoji = SPLATFEST_EMOJI;
	public name = "Splatfest Pro" as const;
	public override channelTopicLabel = "Pro";
}
export class CurrentFest<State extends "FIRST_HALF" | "SECOND_HALF"> extends DisplayableMatchNode {
	public id: string;
	public title: string;
	public midtermTime: Date;
	public state: State;
	public teams: [SchedulesAPI.CurrentFestTeam, SchedulesAPI.CurrentFestTeam, SchedulesAPI.CurrentFestTeam];
	public tricolorStage: TricolorStage;
	public rule = turfWarRule;
	public color = "#0033FF" as const;
	public emoji = SPLATFEST_EMOJI;
	public name = "Tricolor" as const;
	public override channelTopicLabel = "Tricolor";
	public stages: [TricolorStage];
	constructor(data: SchedulesAPI.CurrentFest<State>) {
		super(data);
		this.id = data.id;
		this.title = data.title;
		this.midtermTime = new Date(Date.parse(data.midtermTime));
		this.state = data.state as State;
		this.teams = data.teams;
		this.tricolorStage = new TricolorStage(data.tricolorStage);
		this.stages = [this.tricolorStage];
	}
}

export type GenericMatchNode =
	| ChallengeNode
	| SplatfestOpenNode
	| SplatfestProNode
	| CurrentFest<"FIRST_HALF" | "SECOND_HALF">
	| TurfWarNode
	| RankedOpenNode
	| RankedSeriesNode
	| XBattleNode;

const TEXT_BLUR_SIGMA = 1.00005;
export abstract class BaseCoopNode<
	NodeType extends CommonAPI.BaseNode,
	SettingType extends SchedulesAPI.BaseCoopRegularSetting,
> extends BaseNode {
	public emoji = "🐟";
	public stage: BaseCoopStage;
	public weapons: [
		SchedulesAPI.CoopWeapon,
		SchedulesAPI.CoopWeapon,
		SchedulesAPI.CoopWeapon,
		SchedulesAPI.CoopWeapon,
	];
	constructor(data: NodeType, setting: SettingType) {
		super(data);
		this.stage = new CoopStage(setting.coopStage);
		this.weapons = setting.weapons;
	}
	public override short(): string[][] {
		return [
			[`**${this.stage.emoji}`, `${this.stage.name}**`],
			[this.weapons.map((v) => v.name).join(", ")],
			[
				super
					.short({ showDate: true })
					.map((x) => x.join(" "))
					.join("\n"),
			],
		];
	}
	protected readonly notificationSpecial: boolean = true;
	public notificationText(): string {
		const parts: string[] = [];
		if (this.notificationSpecial)
			parts.push(`** ${this.name} ${"*".repeat(Math.max(40 - 4 - this.name.length, 0))}`);

		parts.push(`${this.notificationSpecial ? "* " : ""}${this.stage.name}:`);
		parts.push(`${this.notificationSpecial ? "* " : ""}${this.weapons.map((v) => v.name).join(", ")}`);
		return parts.join("\n");
	}

	public async embed(b: EmbedBuilder): Promise<EmbedBuilder> {
		return b
			.setTitle(this.name)
			.setColor(this.color)
			.setDescription(
				dedent`Started ${time(this.startTime, TimestampStyles.RelativeTime)}\nEnds ${time(
					this.endTime,
					TimestampStyles.RelativeTime,
				)} ${time(this.endTime, TimestampStyles.ShortTime)} ${time(this.endTime, TimestampStyles.ShortDate)}`,
			)
			.setImage(`attachment://${this.imageName}.png`);
	}

	public async images(): Promise<[Sharp]> {
		const WIDTH = 800;
		const HEIGHT = 600;
		const ICON_SIZE = HEIGHT - 450 - 16;
		return [
			sharp({ create: { width: WIDTH, height: HEIGHT, background: "#00000000", channels: 4 } })
				.composite([
					...(
						await parallel(
							this.weapons.map<Promise<sharp.OverlayOptions[]>>(async (v, i) => {
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
										input: await (() =>
											sharp(
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
												.toBuffer())(),
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
					...(await fillArrayAsync<sharp.OverlayOptions>(this.weapons.length - 1, async (i) => ({
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
					}))),
					{
						input: await (() =>
							sharp(
								Buffer.from(
									(
										await axios.get<ArrayBuffer>(this.stage.image, {
											responseType: "arraybuffer",
											headers: {
												"User-Agent": USER_AGENT,
											},
										})
									).data,
								),
							)
								.composite([
									{
										input: Buffer.from(
											`<svg><rect x="0" y="0" width="800" height="450" rx="8" ry="8"/></svg>`,
										),
										blend: "dest-in",
									},
								])
								.png()
								.toBuffer())(),
						left: 0,
						top: 0,
					},
				])
				.png(),
		];
	}
	public async attachments(): Promise<AttachmentBuilder[]> {
		return [new AttachmentBuilder((await this.images())[0]).setName(`${this.imageName}.png`)];
	}
}

export class SalmonRunNode extends BaseCoopNode<
	SchedulesAPI.CoopGroupingRegularNode,
	SchedulesAPI.BaseCoopRegularSetting
> {
	public color = "#ff5033" as const;
	public name = "Salmon Run" as const;
	public kingSalmonid: z.infer<
		typeof SchedulesAPI.coopGroupingRegularNodeSchema.shape.__splatoon3ink_king_salmonid_guess
	>;
	public get kingSalmonidEmoji() {
		return match(this.kingSalmonid)
			.with("Horrorboros", () => HORRORBOROS_EMOJI)
			.with("Cohozuna", () => COHOZUNA_EMOJI)
			.with("Megalodontia", () => MEGALODONTIA_EMOJI)
			.exhaustive();
	}
	constructor(data: SchedulesAPI.CoopGroupingRegularNode, setting: SchedulesAPI.BaseCoopRegularSetting) {
		super(data, setting);
		this.kingSalmonid = data.__splatoon3ink_king_salmonid_guess;
	}
	public override short() {
		const shortSuper = super.short();
		shortSuper[0]?.push(this.kingSalmonidEmoji);
		return shortSuper;
	}
	protected override readonly notificationSpecial = false;
	public override async embed(b: EmbedBuilder): Promise<EmbedBuilder> {
		const gear = await Rotations.fetchSalmonRunGear();
		b.addFields({
			name: "King salmonid",
			value: `${this.kingSalmonidEmoji} ${this.kingSalmonid}`,
			inline: true,
		})
			.addFields({
				name: "Monthly gear",
				value: gear.name,
				inline: true,
			})
			.setThumbnail(gear.image.url);
		return super.embed(b);
	}
}

export class EggstraWorkNode extends BaseCoopNode<SchedulesAPI.TeamContestNode, SchedulesAPI.TeamContestSetting> {
	public rule = "TEAM_CONTEST";
	public color = "#FDD400" as const;
	public override emoji = "🥇";
	public name = "Eggstra Work" as const;
}

export class BigRunNode extends BaseCoopNode<SchedulesAPI.CoopBigRunNode, SchedulesAPI.CoopBigRunSetting> {
	public rule = "BIG_RUN";
	public color = "#B322FF" as const;
	public name = "Big Run" as const;
}
export type GenericCoopNode = SalmonRunNode | EggstraWorkNode | BigRunNode;
