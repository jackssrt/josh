import { z } from "zod";

export const baseNodeSchema = z.object({
	startTime: z.string(),
	endTime: z.string(),
});
export type BaseNode = z.infer<typeof baseNodeSchema>;
