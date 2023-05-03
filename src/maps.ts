import { ANARCHY_BATTLE_EMOJI, REGULAR_BATTLE_EMOJI, SPLATFEST_EMOJI, X_BATTLE_EMOJI } from "./emojis.js";
import type { RankedVsRule, TurfWarVsRule } from "./types/rotationNotifier.js";

//export type RotationType = "Turf War" | "Anarchy Open" | "Anarchy Series" | "X Battle" | "Splatfest" | "Tricolor";
export type RotationType = "turfwar" | "anarchyopen" | "anarchyseries" | "xbattle" | "splatfest" | "tricolor";
export interface RotationTypeInfo {
	color: `#${string}`;
	name: string;
	emoji: string;
}

export const ROTATION_TYPE_MAP = {
	turfwar: {
		color: "#CFF622",
		emoji: REGULAR_BATTLE_EMOJI,
		name: "Turf War",
	},
	anarchyopen: {
		color: "#F54910",
		emoji: ANARCHY_BATTLE_EMOJI,
		name: "Anarchy Open",
	},
	anarchyseries: {
		color: "#F54910",
		emoji: ANARCHY_BATTLE_EMOJI,
		name: "Anarchy Series",
	},
	splatfest: {
		color: "#0033FF",
		emoji: SPLATFEST_EMOJI,
		name: "Splatfest",
	},
	tricolor: {
		color: "#0033FF",
		emoji: SPLATFEST_EMOJI,
		name: "Tricolor",
	},
	xbattle: {
		color: "#0FDB9B",
		emoji: X_BATTLE_EMOJI,
		name: "X Battle",
	},
} as const satisfies Record<RotationType, RotationTypeInfo>;

export type GameMode = RankedVsRule["rule"] | TurfWarVsRule["rule"];

export interface GameModeInfo {
	color: `#${string}`;
	image: string;
	name: string;
	emoji: string;
}

export const GAME_MODE_MAP = {
	TURF_WAR: {
		image: "https://cdn.wikimg.net/en/splatoonwiki/images/thumb/4/48/S2_Icon_Regular_Battle.svg/375px-S2_Icon_Regular_Battle.svg.png",
		emoji: REGULAR_BATTLE_EMOJI,
		color: "#CFF622",
		name: "Turf War",
	},
	AREA: {
		image: "https://cdn.wikimg.net/en/splatoonwiki/images/3/38/S3_icon_Splat_Zones.png",
		emoji: "<:splatZones:1071477929969721474>",
		color: "#00EFD6",
		name: "Splat Zones",
	},
	CLAM: {
		image: "https://cdn.wikimg.net/en/splatoonwiki/images/e/e3/S3_icon_Clam_Blitz.png",
		emoji: "<:clamBlitz:1071477924764598313>",
		color: "#FFFE00",
		name: "Clam Blitz",
	},
	GOAL: {
		image: "https://cdn.wikimg.net/en/splatoonwiki/images/1/12/S3_icon_Rainmaker.png",
		emoji: "<:rainmaker:1071477926974992384>",
		color: "#FEEF1A",
		name: "Rainmaker",
	},
	LOFT: {
		image: "https://cdn.wikimg.net/en/splatoonwiki/images/b/bc/S3_icon_Tower_Control.png",
		emoji: "<:towerControl:1071477928304578560>",
		color: "#6600E5",
		name: "Tower Control",
	},
} as const satisfies Record<GameMode, GameModeInfo>;
