/* eslint-disable camelcase */
import { z } from "zod";
import { literalUnion } from "./utils.js";

export const monthlyGearSchema = z.object({
	__splatoon3ink_id: z.string(),
	__typename: literalUnion("ClothingGear", "HeadGear"),
	name: z.string(),
	image: z.object({
		url: z.string(),
	}),
});
export type MonthlyGear = z.infer<typeof monthlyGearSchema>;

export const responseSchema = z.object({
	data: z.object({
		coopResult: z.object({
			monthlyGear: monthlyGearSchema,
		}),
	}),
});
export type Response = z.infer<typeof responseSchema>;
