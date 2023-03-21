export default interface SchedulesApiResponse {
	data: {
		regularSchedules: { nodes: RegularNode[] };
		bankaraSchedules: { nodes: BankaraNode[] };
		xSchedules: { nodes: XNode[] };
		leagueSchedules: { nodes: LeagueNode[] };
		coopGroupingSchedule: CoopGroupingNode;
		festSchedules: { nodes: FestNode[] };
		currentFest: CurrentFest<"FIRST_HALF" | "SECOND_HALF"> | null;
	};
}
export interface FestivalsApiResponse {
	US: RegionalFestivalData;
	EU: RegionalFestivalData;
	JP: RegionalFestivalData;
	AP: RegionalFestivalData;
}
export interface RegionalFestivalData {
	data: {
		festRecords: {
			nodes: FestivalNode<FestState>[];
		};
	};
}

export interface BaseNode {
	startTime: string;
	endTime: string;
}

type FestState = "FIRST_HALF" | "SECOND_HALF" | "CLOSED" | "SCHEDULED";

export interface FestivalNode<State extends FestState> extends CurrentFest<State> {
	id: string;
	state: State;
	title: string;
	lang: string;
	image: { url: string };
	teams: [FestivalTeam<State>, FestivalTeam<State>, FestivalTeam<State>];
}

export interface CurrentFest<State extends FestState> extends BaseNode {
	id: string;
	title: string;
	midtermTime: string;
	state: State;
	teams: [CurrentFestTeam, CurrentFestTeam, CurrentFestTeam];
	triColorStage: Stage;
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
export interface FestivalTeam<State extends FestState> extends CurrentFestTeam {
	result: State extends "CLOSED"
		? {
				isWinner: boolean;
				// horagai is japanese for conch
				// this is the ratio of how conch shells the team got
				horagaiRatio: number;
				isHoragaiRatioTop: boolean;
				voteRatio: number;
				isVoteRatioTop: boolean;
				regularContributionRatio: number;
				isRegularContributionRatioTop: boolean;
				challengeContributionRatio: number;
				isChallengeContributionRatioTop: boolean;
				tricolorContributionRatio: number | null;
				isTricolorContributionRatioTop: boolean | null;
		  }
		: null;
	teamName: string;
	image: {
		url: string;
	};
	// tricolor was changed to have teams randomized for each match,
	// so new splatfests will always have this as null
	role: State extends "FIRST_HALF" | "SECOND_HALF" ? "ATTACK" | "DEFENSE" | null : null;
}

// the match settings below are null during a splatfest
export interface RegularNode extends BaseNode {
	regularMatchSetting: RegularSetting | null;
}
export interface BankaraNode extends BaseNode {
	bankaraMatchSettings: [BankaraSetting<"CHALLENGE">, BankaraSetting<"OPEN">] | null;
}
export interface XNode extends BaseNode {
	xMatchSetting: XSetting | null;
}
export interface LeagueNode extends BaseNode {
	leagueMatchSetting: LeagueSetting | null;
}
export interface CoopGroupingNode {
	bannerImage: null;
	regularSchedules: { nodes: CoopGroupingRegularNode[] };
	bigRunSchedules: { nodes: never[] };
}
export interface CoopGroupingRegularNode extends BaseNode {
	setting: CoopGroupingRegularSetting;
	__splatoon3ink_king_salmonid_guess: "Horrorboros" | "Cohozuna";
}
export interface CoopGroupingRegularSetting {
	coopStage: CoopRegularStage;
	weapons: [CoopWeapon, CoopWeapon, CoopWeapon, CoopWeapon];
}
export interface CoopRegularStage {
	name: "Spawning Grounds" | "Sockeye Station" | "Marooner's Bay" | "Gone Fission Hydroplant";
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
	festMatchSetting: FestSetting | null;
}

export interface BaseMatchSetting {
	vsStages: [Stage, Stage];
	festMatchSettings: null;
}
export interface TurfWarVsRule {
	name: "Turf War";
	rule: "TURF_WAR";
	id: "VnNSdWxlLTA=";
}

export interface RegularSetting extends BaseMatchSetting {
	vsRule: TurfWarVsRule;
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
export interface FestSetting extends BaseMatchSetting {
	vsRule: TurfWarVsRule;
}
export interface Stage {
	vsStageId: number;
	name: string;
	image: {
		url: string;
	};
	id: string;
}

export interface SalmonRunAPIResponse {
	data: {
		coopResult: {
			monthlyGear: MonthlyGear;
		};
	};
}

export interface MonthlyGear {
	__splatoon3ink_id: string;
	__typename: string;
	name: string;
	image: { url: string };
}
