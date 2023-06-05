export namespace SchedulesAPI {
	export interface Response {
		data: {
			regularSchedules: { nodes: TurfWarNode[] };
			bankaraSchedules: { nodes: RankedNode[] };
			xSchedules: { nodes: XBattleNode[] };
			eventSchedules: { nodes: ChallengeNode[] };
			coopGroupingSchedule: {
				bannerImage: null;
				regularSchedules: { nodes: CoopGroupingRegularNode[] };
				bigRunSchedules: { nodes: never[] };
				teamContestSchedules: { nodes: TeamContestNode[] };
			};
			festSchedules: { nodes: FestNode[] };
			currentFest: CurrentFest<"FIRST_HALF" | "SECOND_HALF"> | null;
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
	export interface BaseCoopRegularSetting {
		coopStage: CoopRegularStage;
		weapons: [CoopWeapon, CoopWeapon, CoopWeapon, CoopWeapon];
	}
	export interface CoopRegularStage {
		name:
			| "Spawning Grounds"
			| "Sockeye Station"
			| "Marooner's Bay"
			| "Gone Fission Hydroplant"
			| "Jammin' Salmon Junction"
			| "";
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
	export interface CoopWeapon {
		__splatoon3ink_id: string;
		name: string;
		image: {
			url: string;
		};
	}
	export interface FestNode extends BaseNode {
		festMatchSetting: FestSetting | null;
	}
	export interface CurrentFest<State extends "FIRST_HALF" | "SECOND_HALF"> extends BaseNode {
		id: string;
		title: string;
		midtermTime: string;
		state: State;
		teams: [CurrentFestTeam, CurrentFestTeam, CurrentFestTeam];
		tricolorStage: SchedulesAPI.Stage;
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
	export type FestSetting = BaseMatchSetting<TurfWarVsRule>;
	export interface Stage {
		vsStageId: number;
		name: string;
		image: {
			url: string;
		};
		id: string;
	}
}
export namespace FestivalsAPI {
	type FestState = "FIRST_HALF" | "SECOND_HALF" | "CLOSED" | "SCHEDULED";

	export interface Response {
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

	export interface FestivalNode<State extends FestState> extends SchedulesAPI.BaseNode {
		id: string;
		state: State;
		title: string;
		lang: string;
		image: { url: string };
		teams: [FestivalTeam<State>, FestivalTeam<State>, FestivalTeam<State>];
	}
	export interface FestivalTeam<State extends FestState> extends SchedulesAPI.CurrentFestTeam {
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
}
export namespace SalmonRunAPI {
	export interface Response {
		data: {
			coopResult: {
				monthlyGear: MonthlyGear;
			};
		};
	}
	export interface MonthlyGear {
		__splatoon3ink_id: string;
		__typename: "ClothingGear";
		name: string;
		image: {
			url: string;
		};
	}
}
