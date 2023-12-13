import type { HexColorString } from "discord.js";
import {
	CLAM_BLITZ_EMOJI,
	RAINMAKER_EMOJI,
	REGULAR_BATTLE_EMOJI,
	SPLAT_ZONES_EMOJI,
	TOWER_CONTROL_EMOJI,
} from "../emojis.js";
import type * as SchedulesAPI from "../types/schedulesApi.js";

interface BaseRule {
	name: string;
	rule: string;
	id: string;
	emoji: string;
	image: string;
	color: HexColorString;
}
export const turfWarRule = {
	name: "Turf War",
	rule: "TURF_WAR",
	id: "VnNSdWxlLTA:",
	emoji: REGULAR_BATTLE_EMOJI,
	image: "https://cdn.wikimg.net/en/splatoonwiki/images/thumb/4/48/S2_Icon_Regular_Battle.svg/375px-S2_Icon_Regular_Battle.svg.png",
	color: "#CFF622",
} as const satisfies BaseRule;
export const splatZonesRule = {
	name: "Splat Zones",
	rule: "AREA",
	id: "VnNSdWxlLTE:",
	emoji: SPLAT_ZONES_EMOJI,
	image: "https://cdn.wikimg.net/en/splatoonwiki/images/3/38/S3_icon_Splat_Zones.png",
	color: "#00EFD6",
} as const satisfies BaseRule;
export const clamBlitzRule = {
	name: "Clam Blitz",
	rule: "CLAM",
	id: "VnNSdWxlLTQ:",
	emoji: CLAM_BLITZ_EMOJI,
	image: "https://cdn.wikimg.net/en/splatoonwiki/images/e/e3/S3_icon_Clam_Blitz.png",
	color: "#FFFE00" as const,
} as const satisfies BaseRule;
export const rainmakerRule = {
	name: "Rainmaker",
	rule: "GOAL",
	id: "VnNSdWxlLTM:",
	emoji: RAINMAKER_EMOJI,
	image: "https://cdn.wikimg.net/en/splatoonwiki/images/1/12/S3_icon_Rainmaker.png",
	color: "#FEEF1A" as const,
} as const satisfies BaseRule;
export const towerControlRule = {
	name: "Tower Control",
	rule: "LOFT",
	id: "VnNSdWxlLTI:",
	emoji: TOWER_CONTROL_EMOJI,
	image: "https://cdn.wikimg.net/en/splatoonwiki/images/b/bc/S3_icon_Tower_Control.png",
	color: "#6600E5" as const,
} as const satisfies BaseRule;

export const RULE_MAP = {
	AREA: splatZonesRule,
	CLAM: clamBlitzRule,
	GOAL: rainmakerRule,
	LOFT: towerControlRule,
	TURF_WAR: turfWarRule,
} as const satisfies Record<SchedulesAPI.VsRule["rule"], BaseRule>;
export type RankedRule = typeof splatZonesRule | typeof clamBlitzRule | typeof rainmakerRule | typeof towerControlRule;
export type Rule = RankedRule | typeof turfWarRule;
export type APIRuleToRule<Rule extends SchedulesAPI.VsRule> = Rule extends SchedulesAPI.SplatZonesVsRule
	? typeof splatZonesRule
	: Rule extends SchedulesAPI.ClamBlitzVsRule
		? typeof clamBlitzRule
		: Rule extends SchedulesAPI.RainmakerVsRule
			? typeof rainmakerRule
			: Rule extends SchedulesAPI.TowerControlVsRule
				? typeof towerControlRule
				: Rule extends SchedulesAPI.TurfWarVsRule
					? typeof turfWarRule
					: never;
