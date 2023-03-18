declare namespace NodeJS {
	export interface ProcessEnv {
		TOKEN: string;
		OWNER_ID: string;
		CLIENT_ID: string;
		GUILD_ID: string;
		MAPS_CHANNEL_ID: string;
		SALMON_RUN_CHANNEL_ID: string;
		SPLATFEST_TEAM_CATEGORY_ROLE_ID: string;
		GENERAL_CHANNEL_ID: string;
		VOICE_CATEGORY_ID: string;
		COLORS_ROLE_CATEGORY_ID: string;
		DEFAULT_COLOR_ROLE_ID: string;
		INFO_CHANNEL_ID: string;
		GREETER_ROLE_ID: string;
		MEMBER_ROLE_ID: string;
		JOIN_LEAVE_CHANNEL_ID: string;
	}
}
