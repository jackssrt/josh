import type { BaseNode, CurrentFestTeam } from "./schedulesApi.js";

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

export interface FestivalNode<State extends FestState> extends BaseNode {
	id: string;
	state: State;
	title: string;
	lang: string;
	image: { url: string };
	teams: [FestivalTeam<State>, FestivalTeam<State>, FestivalTeam<State>];
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
