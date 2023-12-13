import { z } from "zod";
import { baseNodeSchema } from "./common.js";
import type { Call } from "./utils.js";
import { nodes, repeatedTuple } from "./utils.js";

const festStates = ["FIRST_HALF", "SECOND_HALF", "CLOSED", "SCHEDULED"] as const;
type FestState = (typeof festStates)[number];
const festivalTeamSchema = (state: FestState) =>
	z.object({
		result:
			state === "CLOSED"
				? z.object({
						isWinner: z.boolean(),
						horagaiRatio: z.number(),
						isHoragaiRatioTop: z.boolean(),
						voteRatio: z.number(),
						isVoteRatioTop: z.boolean(),
						regularContributionRatio: z.number(),
						isRegularContributionRatioTop: z.boolean(),
						challengeContributionRatio: z.number(),
						isChallengeContributionRatioTop: z.boolean(),
						tricolorContributionRatio: z.number().nullable(),
						isTricolorContributionRatioTop: z.boolean().nullable(),
					})
				: z.null(),
		teamName: z.string(),
		image: z.object({
			url: z.string(),
		}),
		role: state === "SCHEDULED" ? z.null() : z.enum(["ATTACK", "DEFENSE"]).nullable(),
		color: z.object({
			r: z.number(),
			g: z.number(),
			b: z.number(),
			a: z.number(),
		}),
	});
export type FestivalTeam<State extends FestState> = z.infer<Call<typeof festivalTeamSchema, [State]>>;

export const festivalNodeSchema = <State extends FestState>(state: State) =>
	baseNodeSchema.extend({
		id: z.string(),
		state: z.literal(state),
		title: z.string(),
		lang: z.string(),
		image: z.object({
			url: z.string(),
		}),
		teams: repeatedTuple(festivalTeamSchema, 3, [state]),
	});
export type FestivalNode<State extends FestState> = z.infer<Call<typeof festivalNodeSchema, [State]>>;
export const regionalFestivalDataSchema = z.object({
	data: z.object({
		festRecords: nodes(
			z.discriminatedUnion(
				"state",
				festStates.map((v) => festivalNodeSchema(v)) as [
					Call<typeof festivalNodeSchema, ["FIRST_HALF"]>,
					Call<typeof festivalNodeSchema, ["SECOND_HALF"]>,
					Call<typeof festivalNodeSchema, ["CLOSED"]>,
					Call<typeof festivalNodeSchema, ["SCHEDULED"]>,
				],
			),
		),
	}),
});
export type RegionalFestivalData = z.infer<typeof regionalFestivalDataSchema>;
export const responseSchema = z.object({
	US: regionalFestivalDataSchema,
	EU: regionalFestivalDataSchema,
	JP: regionalFestivalDataSchema,
	AP: regionalFestivalDataSchema,
});
export type Response = z.infer<typeof responseSchema>;
