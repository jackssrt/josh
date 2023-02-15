export interface Schedules {
	data: Data;
}

export interface Data {
	regularSchedules: ScheduleClass;
	bankaraSchedules: ScheduleClass;
	xSchedules: ScheduleClass;
	leagueSchedules: ScheduleClass;
	coopGroupingSchedule: CoopGroupingSchedule;
	festSchedules: ScheduleClass;
	currentFest: null;
	currentPlayer: CurrentPlayer;
	vsStages: VsStages;
}

export interface ScheduleClass {
	nodes: ScheduleNode[];
}

export interface ScheduleNode {
	startTime: string;
	endTime: string;
	bankaraMatchSettings?: MatchSetting[];
	festMatchSetting: null;
	leagueMatchSetting?: MatchSetting;
	regularMatchSetting?: MatchSetting;
	xMatchSetting?: MatchSetting;
}

export interface MatchSetting {
	__isVsSetting: IsVsSetting;
	__typename: IsVsSetting;
	vsStages: Stage[];
	vsRule: VsRule;
	mode?: Mode;
}

export enum IsVsSetting {
	BankaraMatchSetting = "BankaraMatchSetting",
	LeagueMatchSetting = "LeagueMatchSetting",
	RegularMatchSetting = "RegularMatchSetting",
	XMatchSetting = "XMatchSetting",
}

export enum Mode {
	Challenge = "CHALLENGE",
	Open = "OPEN",
}

export interface VsRule {
	name: Name;
	rule: Rule;
	id: string;
}

export enum Name {
	ClamBlitz = "Clam Blitz",
	Rainmaker = "Rainmaker",
	SplatZones = "Splat Zones",
	TowerControl = "Tower Control",
	TurfWar = "Turf War",
}

export enum Rule {
	Area = "AREA",
	Clam = "CLAM",
	Goal = "GOAL",
	Loft = "LOFT",
	TurfWar = "TURF_WAR",
}

export interface Stage {
	vsStageId?: number;
	name: string;
	image: UserIcon;
	id: string;
	thumbnailImage?: UserIcon;
}

export interface UserIcon {
	url: string;
}

export interface CoopGroupingSchedule {
	bannerImage: null;
	regularSchedules: RegularSchedules;
	bigRunSchedules: ScheduleClass;
}

export interface RegularSchedules {
	nodes: PurpleNode[];
}

export interface PurpleNode {
	startTime: string;
	endTime: string;
	setting: Setting;
}

export interface Setting {
	__typename: string;
	coopStage: Stage;
	__isCoopSetting: string;
	weapons: Weapon[];
}

export interface Weapon {
	__splatoon3ink_id: string;
	name: string;
	image: UserIcon;
}

export interface CurrentPlayer {
	userIcon: UserIcon;
}

export interface VsStages {
	nodes: VsStagesNode[];
}

export interface VsStagesNode {
	vsStageId: number;
	originalImage: UserIcon;
	name: string;
	stats: null;
	id: string;
}
