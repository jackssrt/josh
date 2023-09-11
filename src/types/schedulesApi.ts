/* eslint-disable camelcase */
import { z } from "zod";
import type { Call } from "./utils.js";
import { literalUnion, nodes, repeatedTuple } from "./utils.js";

// functions that return a schema are "generic" schemas.

// tried using a generic for the stage schemas, didn't work out :(
export const baseStageSchema = z.object({
	vsStageId: z.number(),
	name: z.string(),
	id: z.string(),
});

export const highImageQualityStageSchema = baseStageSchema.extend({
	originalImage: z.object({
		url: z.string(),
	}),
});
export type HighImageQualityStage = z.infer<typeof highImageQualityStageSchema>;

export const lowImageQualityStageSchema = baseStageSchema.extend({
	image: z.object({
		url: z.string(),
	}),
});
export type LowImageQualityStage = z.infer<typeof lowImageQualityStageSchema>;

export const turfWarVsRuleSchema = z.object({
	name: z.literal("Turf War"),
	rule: z.literal("TURF_WAR"),
	id: z.literal("VnNSdWxlLTA="),
});
export type TurfWarVsRule = z.infer<typeof turfWarVsRuleSchema>;

export const towerControlVsRuleSchema = z.object({
	name: z.literal("Tower Control"),
	rule: z.literal("LOFT"),
	id: z.literal("VnNSdWxlLTI="),
});
export type TowerControlVsRule = z.infer<typeof towerControlVsRuleSchema>;

export const clamBlitzVsRuleSchema = z.object({
	name: z.literal("Clam Blitz"),
	rule: z.literal("CLAM"),
	id: z.literal("VnNSdWxlLTQ="),
});
export type ClamBlitzVsRule = z.infer<typeof clamBlitzVsRuleSchema>;

export const splatZonesVsRuleSchema = z.object({
	name: z.literal("Splat Zones"),
	rule: z.literal("AREA"),
	id: z.literal("VnNSdWxlLTE="),
});
export type SplatZonesVsRule = z.infer<typeof splatZonesVsRuleSchema>;

export const rainmakerVsRuleSchema = z.object({
	name: z.literal("Rainmaker"),
	rule: z.literal("GOAL"),
	id: z.literal("VnNSdWxlLTM="),
});
export type RainmakerVsRule = z.infer<typeof rainmakerVsRuleSchema>;
export const rankedVsRuleSchema = z.union([
	towerControlVsRuleSchema,
	clamBlitzVsRuleSchema,
	splatZonesVsRuleSchema,
	rainmakerVsRuleSchema,
]);
export type RankedVsRule = z.infer<typeof rankedVsRuleSchema>;
export const vsRuleSchema = z.union([rankedVsRuleSchema, turfWarVsRuleSchema]);
export type VsRule = z.infer<typeof vsRuleSchema>;

export const baseMatchSettingSchema = z.object({
	vsStages: repeatedTuple(lowImageQualityStageSchema, 2),
	festMatchSettings: z.null().optional(),
	vsRule: rankedVsRuleSchema.or(turfWarVsRuleSchema),
});
export type BaseMatchSetting = z.infer<typeof baseMatchSettingSchema>;
export const turfWarSettingSchema = baseMatchSettingSchema.extend({
	__typename: z.literal("RegularMatchSetting"),
});
export type TurfWarSetting = z.infer<typeof turfWarSettingSchema>;

export const rankedSettingSchema = (mode: "OPEN" | "CHALLENGE") =>
	baseMatchSettingSchema.extend({
		__typename: z.literal("BankaraMatchSetting"),
		bankaraMode: z.literal(mode),
		vsRule: rankedVsRuleSchema,
	});
export type RankedSetting<Mode extends Parameters<typeof rankedSettingSchema>[0]> = z.infer<
	Call<typeof rankedSettingSchema, [Mode]>
>;

export const xBattleSettingSchema = baseMatchSettingSchema.extend({
	__typename: z.literal("XMatchSetting"),
	vsRule: rankedVsRuleSchema,
});
export type XBattleSetting = z.infer<typeof xBattleSettingSchema>;

export const challengeSettingSchema = baseMatchSettingSchema.extend({
	leagueMatchEvent: z.object({
		leagueMatchEventId: z.string(),
		name: z.string(),
		desc: z.string(),
		regulationUrl: z.string().nullable(),
		regulation: z.string(),
		id: z.string(),
	}),
	__isVsSetting: z.literal("LeagueMatchSetting"),
	__typename: z.literal("LeagueMatchSetting"),
	vsRule: vsRuleSchema,
});
export type ChallengeSetting = z.infer<typeof challengeSettingSchema>;

export const festSettingSchema = (mode: "REGULAR" | "CHALLENGE") =>
	baseMatchSettingSchema.extend({
		festMode: z.literal(mode),
		__typename: z.literal("FestMatchSetting"),
		vsRule: turfWarVsRuleSchema,
	});
export type FestSetting<Mode extends "REGULAR" | "CHALLENGE"> = z.infer<Call<typeof festSettingSchema, [Mode]>>;

export const coopWeaponSchema = z.object({
	__splatoon3ink_id: z.string(),
	name: z.string(),
	image: z.object({
		url: z.string(),
	}),
});
export type CoopWeapon = z.infer<typeof coopWeaponSchema>;

export const coopStageSchema = (bigRun = false) =>
	z.object({
		name: !bigRun
			? literalUnion(
					"Spawning Grounds",
					"Sockeye Station",
					"Marooner's Bay",
					"Gone Fission Hydroplant",
					"Jammin' Salmon Junction",
					"Salmonid Smokeyard",
					"",
			  )
			: z.string(),
		thumbnailImage: z.object({
			url: z.string(),
		}),
		image: z.object({
			url: z.string(),
		}),
		id: z.string(),
	});
export type CoopStage<BigRun extends boolean = false> = z.infer<Call<typeof coopStageSchema, [BigRun]>>;
export const baseCoopRegularSettingSchema = (bigRun = false) =>
	z.object({
		coopStage: coopStageSchema(bigRun),
		weapons: z.tuple([coopWeaponSchema, coopWeaponSchema, coopWeaponSchema, coopWeaponSchema]),
	});
export type BaseCoopRegularSetting = z.infer<ReturnType<typeof baseCoopRegularSettingSchema>>;

export const teamContestSettingSchema = baseCoopRegularSettingSchema(false).extend({
	rule: z.literal("TEAM_CONTEST"),
});
export type TeamContestSetting = z.infer<typeof teamContestSettingSchema>;

export const coopBigRunSettingSchema = baseCoopRegularSettingSchema(true).extend({
	rule: z.literal("BIG_RUN"),
});
export type CoopBigRunSetting = z.infer<typeof coopBigRunSettingSchema>;

export const currentFestTeamSchema = z.object({
	id: z.string(),
	color: z.object({
		a: z.number(),
		r: z.number(),
		g: z.number(),
		b: z.number(),
	}),
});
export type CurrentFestTeam = z.infer<typeof currentFestTeamSchema>;

export const currentFestSchema = (state: "FIRST_HALF" | "SECOND_HALF") =>
	baseNodeSchema.extend({
		id: z.string(),
		title: z.string(),
		midtermTime: z.string(),
		state: z.literal(state),
		teams: repeatedTuple(currentFestTeamSchema, 3),
		tricolorStage: lowImageQualityStageSchema,
	});
export type CurrentFest<State extends "FIRST_HALF" | "SECOND_HALF"> = z.infer<Call<typeof currentFestSchema, [State]>>;

export const baseNodeSchema = z.object({
	startTime: z.string(),
	endTime: z.string(),
});
export type BaseNode = z.infer<typeof baseNodeSchema>;
export const festNodeSchema = baseNodeSchema.extend({
	festMatchSettings: z.tuple([festSettingSchema("CHALLENGE"), festSettingSchema("REGULAR")]).nullable(),
});
export type FestNode = z.infer<typeof festNodeSchema>;
export const turfWarNodeSchema = baseNodeSchema.extend({
	regularMatchSetting: turfWarSettingSchema.nullable(),
});
export type TurfWarNode = z.infer<typeof turfWarNodeSchema>;

export const rankedNodeSchema = baseNodeSchema.extend({
	bankaraMatchSettings: z.tuple([rankedSettingSchema("CHALLENGE"), rankedSettingSchema("OPEN")]).nullable(),
});
export type RankedNode = z.infer<typeof rankedNodeSchema>;

export const xBattleNodeSchema = baseNodeSchema.extend({
	xMatchSetting: xBattleSettingSchema.nullable(),
});
export type XBattleNode = z.infer<typeof xBattleNodeSchema>;

export const challengeTimePeriodSchema = z.object({
	startTime: z.string(),
	endTime: z.string(),
});
export type ChallengeTimePeriod = z.infer<typeof challengeTimePeriodSchema>;

export const challengeNodeSchema = z.object({
	leagueMatchSetting: challengeSettingSchema.nullable(),
	timePeriods: z.array(challengeTimePeriodSchema),
});
export type ChallengeNode = z.infer<typeof challengeNodeSchema>;

export const kingSalmoidGuessSchema = z.object({
	__splatoon3ink_king_salmonid_guess: literalUnion("Horrorboros", "Cohozuna"),
});

export const coopGroupingRegularNodeSchema = baseNodeSchema.extend(kingSalmoidGuessSchema.shape).extend({
	setting: baseCoopRegularSettingSchema(false),
});
export type CoopGroupingRegularNode = z.infer<typeof coopGroupingRegularNodeSchema>;

export const teamContestNodeSchema = baseNodeSchema.extend({
	setting: teamContestSettingSchema,
});
export type TeamContestNode = z.infer<typeof teamContestNodeSchema>;

const coopBigRunNodeSchema = baseNodeSchema.extend(kingSalmoidGuessSchema.shape).extend({
	setting: coopBigRunSettingSchema,
});
export type CoopBigRunNode = z.infer<typeof coopBigRunNodeSchema>;

export const responseSchema = z.object({
	data: z.object({
		regularSchedules: nodes(turfWarNodeSchema),
		bankaraSchedules: nodes(rankedNodeSchema),
		xSchedules: nodes(xBattleNodeSchema),
		eventSchedules: nodes(challengeNodeSchema),
		coopGroupingSchedule: z.object({
			bannerImage: z.null(),
			regularSchedules: nodes(coopGroupingRegularNodeSchema),
			bigRunSchedules: nodes(coopBigRunNodeSchema),
			teamContestSchedules: nodes(teamContestNodeSchema),
		}),
		festSchedules: nodes(festNodeSchema),
		currentFest: z.union([currentFestSchema("FIRST_HALF"), currentFestSchema("SECOND_HALF")]).nullable(),
		vsStages: nodes(highImageQualityStageSchema),
	}),
});
export type Response = z.infer<typeof responseSchema>;
