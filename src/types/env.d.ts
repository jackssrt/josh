declare namespace NodeJS {
	export interface ProcessEnv {
		TOKEN: string;
		OWNER_ID: string;
		CLIENT_ID: string;
		GUILD_ID: string;
		MAPS_CHANNEL_ID: string;
		SPLATFEST_TEAM_CATEGORY_ROLE_ID: string;
		GENERAL_CHANNEL_ID: string;
	}
}
