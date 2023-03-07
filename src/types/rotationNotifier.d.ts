export default interface APIResponse {
	data: {
		regularSchedules: { nodes: RegularNode[] };
		bankaraSchedules: { nodes: BankaraNode[] };
		xSchedules: { nodes: XNode[] };
		leagueSchedules: { nodes: LeagueNode[] };
		coopGroupingSchedule: CoopGroupingNode;
		festSchedules: { nodes: FestNode[] };
		currentFest: null;
	};
}

export interface BaseNode {
	startTime: string;
	endTime: string;
}
export interface RegularNode extends BaseNode {
	regularMatchSetting: RegularSetting;
}
export interface BankaraNode extends BaseNode {
	bankaraMatchSettings: [BankaraSetting<"CHALLENGE">, BankaraSetting<"OPEN">];
}
export interface XNode extends BaseNode {
	xMatchSetting: XSetting;
}
export interface LeagueNode extends BaseNode {
	leagueMatchSetting: LeagueSetting;
}
export interface CoopGroupingNode {
	bannerImage: null;
	regularSchedules: { nodes: CoopGroupingRegularNode[] };
	bigRunSchedules: { nodes: never[] };
}
export interface CoopGroupingRegularNode extends BaseNode {
	setting: CoopGroupingRegularSetting;
}
export interface CoopGroupingRegularSetting {
	coopStage: CoopRegularStage;
	weapons: [CoopWeapon, CoopWeapon, CoopWeapon, CoopWeapon];
}
export interface CoopRegularStage {
	name: string;
	thumbnailImage: {
		url: string;
	};
	image: {
		url: string;
	};
	id: string;
}
export interface CoopWeapon {
	name: string;
	image: {
		url: string;
	};
}
export interface FestNode extends BaseNode {
	festMatchSetting: null;
}

export interface BaseMatchSetting {
	vsStages: Stage[];
	festMatchSettings: null;
}

export interface RegularSetting extends BaseMatchSetting {
	vsRule: {
		name: "Turf War";
		rule: "TURF_WAR";
		id: "VnNSdWxlLTA=";
	};
}

export interface TowerControlVsRule {
	name: "Tower Control";
	rule: "LOFT";
	id: "VnNSdWxlLTI=";
}
export interface ClamBlitzVsRule {
	name: "Clam Blitz";
	rule: "CLAM";
	id: "VnNSdWxlLTQ=";
}
export interface SplatZonesVsRule {
	name: "Splat Zones";
	rule: "AREA";
	id: "VnNSdWxlLTE=";
}
export interface RainmakerVsRule {
	name: "Rainmaker";
	rule: "GOAL";
	id: "VnNSdWxlLTM=";
}

type RankedVsRule = TowerControlVsRule | ClamBlitzVsRule | SplatZonesVsRule | RainmakerVsRule;

export interface BankaraSetting<Mode extends "OPEN" | "CHALLENGE" = "OPEN" | "CHALLENGE"> extends BaseMatchSetting {
	vsRule: RankedVsRule;
	mode: Mode;
}

export interface XSetting extends BaseMatchSetting {
	vsRule: RankedVsRule;
}
export interface LeagueSetting extends BaseMatchSetting {
	vsRule: RankedVsRule;
}

export interface Stage {
	vsStageId: number;
	name: string;
	image: {
		url: string;
	};
	id: string;
}
