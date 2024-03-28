import * as dotenv from "dotenv";
import path from "node:path";
import { z } from "zod";
dotenv.config();
const snowflakeSchema = z.string().refine((value) => !Number.isNaN(Number(value)), "Invalid Discord Snowflake");
const snowflakeListSchema = z.string().refine((value) => {
	const snowflakes = String(value).split(",");
	return snowflakes.every((snowflake) => !Number.isNaN(Number(snowflake)));
}, "Invalid Discord Snowflake List");

export const processEnvSchema = z.object({
	NODE_ENV: z.enum(["test", "development", "production"]),
	TOKEN: z.string(),
	OWNER_ID: snowflakeSchema,
	CLIENT_ID: snowflakeSchema,
	GUILD_ID: snowflakeSchema,
	MAPS_CHANNEL_ID: snowflakeSchema,
	SALMON_RUN_CHANNEL_ID: snowflakeSchema,
	SPLATFEST_TEAM_CATEGORY_ROLE_ID: snowflakeSchema,
	GENERAL_CHANNEL_ID: snowflakeSchema,
	VOICE_CATEGORY_ID: snowflakeSchema,
	UNUSED_VOICE_CATEGORY_ID: snowflakeSchema,
	COLORS_ROLE_CATEGORY_ID: snowflakeSchema,
	DEFAULT_COLOR_ROLE_ID: snowflakeSchema,
	RULES_CHANNEL_ID: snowflakeSchema,
	GREETER_ROLE_ID: snowflakeSchema,
	MEMBER_ROLE_ID: snowflakeSchema,
	JOIN_LEAVE_CHANNEL_ID: snowflakeSchema,
	TTS_CHANNEL_ID: snowflakeSchema,
	STATS_CHANNEL_ID: snowflakeSchema,
	ROLEPLAYER_IDS: snowflakeListSchema,
	JOIN_IGNORE_IDS: snowflakeListSchema,
	ALT_USER_ID: snowflakeSchema,
	ANNOUNCEMENTS_CHANNEL_ID: snowflakeSchema,
	VOICE_LOG_CHANNEL_ID: snowflakeSchema,
});
declare global {
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace NodeJS {
		// eslint-disable-next-line @typescript-eslint/no-empty-interface, @typescript-eslint/consistent-type-definitions
		interface ProcessEnv extends z.infer<typeof processEnvSchema> {}
	}
}
processEnvSchema.parse(process.env);

export const IS_PROD = process.env.NODE_ENV === "production";
export const IS_DEV = !IS_PROD;
export const IS_BUILT = path.extname(import.meta.url) !== ".ts";
