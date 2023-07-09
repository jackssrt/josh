import path from "node:path";

export interface ProcessEnv {
	NODE_ENV: "test" | "development" | "production";
	TOKEN: string;
	OWNER_ID: string;
	CLIENT_ID: string;
	GUILD_ID: string;
	MAPS_CHANNEL_ID: string;
	SALMON_RUN_CHANNEL_ID: string;
	SPLATFEST_TEAM_CATEGORY_ROLE_ID: string;
	GENERAL_CHANNEL_ID: string;
	VOICE_CATEGORY_ID: string;
	UNUSED_VOICE_CATEGORY_ID: string;
	COLORS_ROLE_CATEGORY_ID: string;
	DEFAULT_COLOR_ROLE_ID: string;
	RULES_CHANNEL_ID: string;
	GREETER_ROLE_ID: string;
	MEMBER_ROLE_ID: string;
	JOIN_LEAVE_CHANNEL_ID: string;
	REPLIT_DB_URL: string | undefined;
	REPL_ID: string | undefined;
	CREATE_MATCH_CHANNEL_ID: string;
	MATCH_CHANNEL_CATEGORY_ID: string;
	TTS_CHANNEL_ID: string;
	STATS_CHANNEL_ID: string;
	ROLEPLAYER_IDS: string;
	JOIN_IGNORE_IDS: string;
}

export default function getEnv<T extends keyof ProcessEnv>(key: T): ProcessEnv[T] {
	return process.env[key] as ProcessEnv[T];
}

export const IS_PROD = !!getEnv("REPL_ID");
export const IS_DEV = !IS_PROD;
export const IS_BUILT = path.extname(import.meta.url) !== ".ts";
