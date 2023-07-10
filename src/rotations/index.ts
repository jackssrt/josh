import axios from "axios";
import consola from "consola";
import type { Awaitable } from "discord.js";
import { USER_AGENT } from "../client.js";
import database from "../database.js";
import type * as SalmonRunAPI from "../types/salmonRunApi.js";
import type * as SchedulesAPI from "../types/schedulesApi.js";
import { LARGEST_DATE, formatTime, iteratorToArray, parallel } from "../utils.js";
import { PoppingTimeRangeCollection } from "./TimeRangeCollection.js";
import {
	ChallengeNode,
	CurrentFest,
	EggstraWorkNode,
	RankedOpenNode,
	RankedSeriesNode,
	SalmonRunNode,
	SplatfestNode,
	TurfWarNode,
	XBattleNode,
} from "./nodes.js";

export interface FetchedRotations {
	splatfest: PoppingTimeRangeCollection<SplatfestNode | undefined>;
	turfWar: PoppingTimeRangeCollection<TurfWarNode | undefined>;
	rankedOpen: PoppingTimeRangeCollection<RankedOpenNode | undefined>;
	rankedSeries: PoppingTimeRangeCollection<RankedSeriesNode | undefined>;
	xBattle: PoppingTimeRangeCollection<XBattleNode | undefined>;
	challenges: PoppingTimeRangeCollection<ChallengeNode | undefined>;
	salmonRun: PoppingTimeRangeCollection<SalmonRunNode>;
	eggstraWork: PoppingTimeRangeCollection<EggstraWorkNode>;
	startTime: Date;
	endTime: Date;
	salmonStartTime: Date;
	salmonEndTime: Date;
	currentFest: CurrentFest<"FIRST_HALF" | "SECOND_HALF"> | undefined;
	wasCached: boolean;
	salmonRunChanged: boolean;
}

export class Rotations {
	private readonly hooks = new Set<() => Awaitable<void>>();
	private readonly salmonHooks = new Set<() => Awaitable<void>>();
	private constructor(
		public challenges: PoppingTimeRangeCollection<ChallengeNode | undefined>,
		public turfWar: PoppingTimeRangeCollection<TurfWarNode | undefined>,
		public rankedOpen: PoppingTimeRangeCollection<RankedOpenNode | undefined>,
		public rankedSeries: PoppingTimeRangeCollection<RankedSeriesNode | undefined>,
		public xBattle: PoppingTimeRangeCollection<XBattleNode | undefined>,
		public salmonRun: PoppingTimeRangeCollection<SalmonRunNode>,
		public splatfest: PoppingTimeRangeCollection<SplatfestNode | undefined>,
		public eggstraWork: PoppingTimeRangeCollection<EggstraWorkNode | undefined>,
		public currentFest: CurrentFest<"FIRST_HALF" | "SECOND_HALF"> | undefined,
		public startTime: Date,
		public endTime: Date,
		public salmonStartTime: Date,
		public salmonEndTime: Date,
		private catchingUp: boolean,
		private catchingUpSalmonRun: boolean,
	) {}

	public static async new(): Promise<Rotations> {
		const fetched = await this.fetch();
		const rotations = new this(
			fetched.challenges,
			fetched.turfWar,
			fetched.rankedOpen,
			fetched.rankedSeries,
			fetched.xBattle,
			fetched.salmonRun,
			fetched.splatfest,
			fetched.eggstraWork,
			fetched.currentFest,
			fetched.startTime,
			fetched.endTime,
			fetched.salmonStartTime,
			fetched.salmonEndTime,
			!fetched.wasCached,
			fetched.salmonRunChanged,
		);
		consola.info("rotations instantiated, cached:", fetched.wasCached);
		consola.info(
			"Time until next rotation fetch",
			formatTime((rotations.endTime.getTime() - new Date().getTime()) / 1000),
		);
		setTimeout(function timeout() {
			void (async () => {
				const fetched = await Rotations.fetch();
				consola.info("rotations fetched, cached:", fetched.wasCached);
				rotations.applyRotations(fetched);
				await parallel(rotations.notifyChanged(), fetched.salmonRunChanged && rotations.notifySalmonChanged());
				setTimeout(timeout, rotations.endTime.getTime() - new Date().getTime());
			})();
		}, fetched.endTime.getTime() - new Date().getTime());
		return rotations;
	}
	public async notifyChanged() {
		await parallel(...iteratorToArray(this.hooks.values()).map(async (v) => await v()));
	}
	public async notifySalmonChanged() {
		await parallel(...iteratorToArray(this.salmonHooks.values()).map(async (v) => await v()));
	}
	public async forceUpdate() {
		const fetched = await Rotations.fetch(true);
		this.applyRotations(fetched);
	}

	public hook(func: () => Awaitable<void>) {
		this.hooks.add(func);
		if (this.catchingUp)
			void (async () => {
				await func();
			})();
	}
	public hookSalmon(func: () => Awaitable<void>) {
		this.salmonHooks.add(func);
		if (this.catchingUpSalmonRun)
			void (async () => {
				await func();
			})();
	}
	public static async fetchSalmonRunGear(): Promise<SalmonRunAPI.MonthlyGear> {
		const [cachedGearMonth, cachedGear] = await database.getCachedSalmonRunGear();
		consola.info("salmon run gear fetched, cached:", cachedGearMonth === new Date().getMonth() && cachedGear);
		if (cachedGearMonth === new Date().getMonth() && cachedGear) return cachedGear;
		const response = await axios.get<SalmonRunAPI.Response>("https://splatoon3.ink/data/coop.json", {
			headers: { "User-Agent": USER_AGENT },
		});
		const monthlyGear = response.data.data.coopResult.monthlyGear;
		await database.setCachedSalmonRunGear(monthlyGear);
		return monthlyGear;
	}

	private static async fetch(ignoreCache = false): Promise<FetchedRotations> {
		if (process.env.NODE_ENV === "test")
			return {
				splatfest: new PoppingTimeRangeCollection([]),
				challenges: new PoppingTimeRangeCollection([]),
				turfWar: new PoppingTimeRangeCollection([]),
				rankedOpen: new PoppingTimeRangeCollection([]),
				rankedSeries: new PoppingTimeRangeCollection([]),
				xBattle: new PoppingTimeRangeCollection([]),
				salmonRun: new PoppingTimeRangeCollection([]),
				eggstraWork: new PoppingTimeRangeCollection([]),
				startTime: LARGEST_DATE,
				endTime: LARGEST_DATE,
				salmonStartTime: LARGEST_DATE,
				salmonEndTime: LARGEST_DATE,
				currentFest: undefined,
				wasCached: true,
				salmonRunChanged: false,
			};
		const cached = !ignoreCache ? await database.getCachedMapRotation() : undefined;
		// send api request
		const response =
			cached ??
			(
				await axios.get<SchedulesAPI.Response>("https://splatoon3.ink/data/schedules.json", {
					headers: {
						"User-Agent": USER_AGENT,
					},
				})
			).data;
		const {
			data: {
				regularSchedules: { nodes: rawTurfWar },
				bankaraSchedules: { nodes: rawRanked },
				xSchedules: { nodes: rawXBattle },
				eventSchedules: { nodes: rawChallenges },
				coopGroupingSchedule: {
					regularSchedules: { nodes: rawSalmonRun },
					teamContestSchedules: { nodes: rawEggstraWork },
				},
				festSchedules: { nodes: rawSplatfest },
				vsStages: { nodes: vsStages },
				currentFest: rawCurrentFest,
			},
		} = response;

		const challenges = new PoppingTimeRangeCollection(
			rawChallenges.map((x) =>
				x.leagueMatchSetting && x.timePeriods.length > 0
					? new ChallengeNode(x, x.leagueMatchSetting, vsStages)
					: undefined,
			),
		);
		const turfWar = new PoppingTimeRangeCollection(
			rawTurfWar.map((x) =>
				x.regularMatchSetting ? new TurfWarNode(x, x.regularMatchSetting, vsStages) : undefined,
			),
		);
		const rankedOpen = new PoppingTimeRangeCollection(
			rawRanked.map((x) =>
				x.bankaraMatchSettings ? new RankedOpenNode(x, x.bankaraMatchSettings[1], vsStages) : undefined,
			),
		);
		const rankedSeries = new PoppingTimeRangeCollection(
			rawRanked.map((x) =>
				x.bankaraMatchSettings ? new RankedSeriesNode(x, x.bankaraMatchSettings[0], vsStages) : undefined,
			),
		);
		const xBattle = new PoppingTimeRangeCollection(
			rawXBattle.map((x) => (x.xMatchSetting ? new XBattleNode(x, x.xMatchSetting, vsStages) : undefined)),
		);
		const salmonRun = new PoppingTimeRangeCollection(rawSalmonRun.map((x) => new SalmonRunNode(x, x.setting)));
		const eggstraWork = new PoppingTimeRangeCollection(
			rawEggstraWork.map((x) => new EggstraWorkNode(x, x.setting)),
		);
		const splatfest = new PoppingTimeRangeCollection(
			rawSplatfest.map((x) =>
				x.festMatchSetting ? new SplatfestNode(x, x.festMatchSetting, vsStages) : undefined,
			),
		);
		const currentFest = rawCurrentFest ? new CurrentFest(rawCurrentFest, vsStages) : undefined;
		// gets the earliest normal rotation endTime
		const startTime = new Date(
			Math.min(...[turfWar, splatfest].flatMap((x) => x.active?.startTime.getTime() ?? [])),
		);
		const endTime = new Date(Math.min(...[turfWar, splatfest].flatMap((x) => x.active?.endTime.getTime() ?? [])));
		const salmonStartTime = new Date(
			Math.min(...[salmonRun, eggstraWork].flatMap((x) => x.active?.endTime.getTime() ?? [])),
		);
		const salmonEndTime = new Date(
			Math.min(...[salmonRun, eggstraWork].flatMap((x) => x.active?.endTime.getTime() ?? [])),
		);
		const lastSalmonEndTime = await database.getSalmonRunEndTime();
		if (!cached)
			await parallel(
				database.setCachedMapRotation(endTime, response),
				database.setSalmonRunEndTime(salmonEndTime),
			);
		return {
			splatfest,
			challenges,
			turfWar,
			rankedOpen,
			rankedSeries,
			xBattle,
			salmonRun,
			eggstraWork,
			startTime,
			endTime,
			salmonStartTime,
			salmonEndTime,
			currentFest,
			wasCached: !!cached,
			salmonRunChanged: lastSalmonEndTime.getTime() !== salmonEndTime.getTime(),
		} as const;
	}
	private applyRotations(this: Rotations, rotations: FetchedRotations) {
		Object.entries(rotations).forEach((<T extends keyof FetchedRotations & keyof Rotations>([k, v]: [
			T,
			FetchedRotations[T],
		]) => {
			if (
				!new Set<string>(["wasCached", "salmonRunChanged"] as Exclude<
					keyof FetchedRotations,
					keyof Rotations
				>[]).has(k)
			)
				this[k] = v as Rotations[T];
		}) as (param: [string, unknown]) => void);
		this.catchingUp = false;
		this.catchingUpSalmonRun = false;
	}
}
const rotations = await Rotations.new();
export default rotations;
