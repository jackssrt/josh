export interface Response {
	data: {
		regularSchedules: { nodes: TurfWarNode[] };
		bankaraSchedules: { nodes: RankedNode[] };
		xSchedules: { nodes: XBattleNode[] };
		eventSchedules: { nodes: ChallengeNode[] };
		coopGroupingSchedule: {
			bannerImage: null;
			regularSchedules: { nodes: CoopGroupingRegularNode[] };
			bigRunSchedules: { nodes: CoopBigRunNode[] };
			teamContestSchedules: { nodes: TeamContestNode[] };
		};
		festSchedules: { nodes: FestNode[] };
		currentFest: CurrentFest<"FIRST_HALF" | "SECOND_HALF"> | null;
		vsStages: { nodes: Stage<"high">[] };
	};
}

export interface BaseNode {
	startTime: string;
	endTime: string;
}

// the match settings below are null during a splatfest
export interface TurfWarNode extends BaseNode {
	regularMatchSetting: TurfWarSetting | null;
}
export interface RankedNode extends BaseNode {
	bankaraMatchSettings: [RankedSetting<"CHALLENGE">, RankedSetting<"OPEN">] | null;
}
export interface XBattleNode extends BaseNode {
	xMatchSetting: XBattleSetting | null;
}
export interface ChallengeNode {
	leagueMatchSetting: ChallengeSetting | null;
	timePeriods: ChallengeTimePeriod[];
}
export interface ChallengeTimePeriod {
	startTime: string;
	endTime: string;
}
export interface CoopGroupingRegularNode extends BaseNode {
	setting: BaseCoopRegularSetting;
	__splatoon3ink_king_salmonid_guess: "Horrorboros" | "Cohozuna";
}
export interface BaseCoopRegularSetting<BigRun extends boolean = false> {
	coopStage: CoopStage<BigRun>;
	weapons: [CoopWeapon, CoopWeapon, CoopWeapon, CoopWeapon];
}
export interface CoopStage<BigRun extends boolean = false> {
	name: BigRun extends false
		?
				| "Spawning Grounds"
				| "Sockeye Station"
				| "Marooner's Bay"
				| "Gone Fission Hydroplant"
				| "Jammin' Salmon Junction"
				| "Salmonid Smokeyard"
				| ""
		: string;
	thumbnailImage: {
		url: string;
	};
	image: {
		url: string;
	};
	id: string;
}
export interface TeamContestNode extends BaseNode {
	setting: TeamContestSetting;
}
export interface TeamContestSetting extends BaseCoopRegularSetting {
	rule: "TEAM_CONTEST";
}
export interface CoopBigRunNode extends BaseNode {
	setting: CoopBigRunSetting;
	__splatoon3ink_king_salmonid_guess: "Horrorboros" | "Cohozuna";
}
export interface CoopBigRunSetting extends BaseCoopRegularSetting<true> {
	rule: "BIG_RUN";
}
export interface CoopWeapon {
	__splatoon3ink_id: string;
	name: string;
	image: {
		url: string;
	};
}
export interface FestNode extends BaseNode {
	festMatchSettings: [FestSetting<"CHALLENGE">, FestSetting<"REGULAR">] | null;
}
export interface CurrentFest<State extends "FIRST_HALF" | "SECOND_HALF"> extends BaseNode {
	id: string;
	title: string;
	midtermTime: string;
	state: State;
	teams: [CurrentFestTeam, CurrentFestTeam, CurrentFestTeam];
	tricolorStage: Stage;
}
export interface CurrentFestTeam {
	id: string;
	color: {
		a: number;
		r: number;
		g: number;
		b: number;
	};
}

export interface BaseMatchSetting<Rule extends VsRule, HasFestMatchSettings extends boolean = true> {
	vsStages: [Stage, Stage];
	festMatchSettings: HasFestMatchSettings extends true ? null : never;
	vsRule: Rule;
}
export interface TurfWarVsRule {
	name: "Turf War";
	rule: "TURF_WAR";
	id: "VnNSdWxlLTA=";
}

export interface TurfWarSetting extends BaseMatchSetting<TurfWarVsRule> {
	__typename: "RegularMatchSetting";
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

export type RankedVsRule = TowerControlVsRule | ClamBlitzVsRule | SplatZonesVsRule | RainmakerVsRule;
export type VsRule = RankedVsRule | TurfWarVsRule;
export interface RankedSetting<Mode extends "OPEN" | "CHALLENGE" = "OPEN" | "CHALLENGE">
	extends BaseMatchSetting<RankedVsRule> {
	__typename: "BankaraMatchSetting";
	mode: Mode;
}

export interface XBattleSetting extends BaseMatchSetting<RankedVsRule> {
	__typename: "XMatchSetting";
}
export interface ChallengeSetting extends BaseMatchSetting<TurfWarVsRule, false> {
	leagueMatchEvent: {
		leagueMatchEventId: string;
		name: string;
		desc: string;
		regulationUrl: null;
		regulation: string;
		id: string;
	};
	__isVsSetting: "LeagueMatchSetting";
	__typename: "LeagueMatchSetting";
}
export interface FestSetting<Mode extends "REGULAR" | "CHALLENGE" = "REGULAR" | "CHALLENGE">
	extends BaseMatchSetting<TurfWarVsRule> {
	festMode: Mode;
	__typename: "FestMatchSetting";
}
export interface Stage<Quality extends "high" | "low" = "low"> {
	vsStageId: number;
	name: string;
	image: Quality extends "low"
		? {
				url: string;
		  }
		: never;
	originalImage: Quality extends "high"
		? {
				url: string;
		  }
		: never;
	id: string;
}
