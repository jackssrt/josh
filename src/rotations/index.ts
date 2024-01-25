import type { Awaitable } from "discord.js";
import { USER_AGENT } from "../client.js";
import database from "../database.js";
import { reportSchemaFail } from "../errorhandler.js";
import * as SalmonRunAPI from "../schemas/salmonRunApi.js";
import * as SchedulesAPI from "../schemas/schedulesApi.js";
import logger from "../utils/Logger.js";
import { request } from "../utils/http.js";
import { parallel } from "../utils/promise.js";
import { LARGEST_DATE, formatTime } from "../utils/time.js";
import { PoppingTimePeriodCollection } from "./TimePeriodCollection.js";
import {
	BigRunNode,
	ChallengeNode,
	CurrentFest,
	EggstraWorkNode,
	RankedOpenNode,
	RankedSeriesNode,
	SalmonRunNode,
	SplatfestOpenNode,
	SplatfestProNode,
	TurfWarNode,
	XBattleNode,
} from "./nodes.js";

export type FetchedRotations = {
	splatfestPro: PoppingTimePeriodCollection<SplatfestProNode | undefined>;
	splatfestOpen: PoppingTimePeriodCollection<SplatfestOpenNode | undefined>;
	turfWar: PoppingTimePeriodCollection<TurfWarNode | undefined>;
	rankedOpen: PoppingTimePeriodCollection<RankedOpenNode | undefined>;
	rankedSeries: PoppingTimePeriodCollection<RankedSeriesNode | undefined>;
	xBattle: PoppingTimePeriodCollection<XBattleNode | undefined>;
	challenges: PoppingTimePeriodCollection<ChallengeNode | undefined>;
	salmonRun: PoppingTimePeriodCollection<SalmonRunNode>;
	bigRun: PoppingTimePeriodCollection<BigRunNode | undefined>;
	eggstraWork: PoppingTimePeriodCollection<EggstraWorkNode | undefined>;
	startTime: Date;
	endTime: Date;
	salmonStartTime: Date;
	salmonEndTime: Date;
	currentFest: CurrentFest<"FIRST_HALF" | "SECOND_HALF"> | undefined;
	wasCached: boolean;
	salmonRunChanged: boolean;
};

export class Rotations {
	private readonly hooks = new Set<() => Awaitable<void>>();
	private readonly salmonHooks = new Set<() => Awaitable<void>>();
	private constructor(
		public challenges: PoppingTimePeriodCollection<ChallengeNode | undefined>,
		public turfWar: PoppingTimePeriodCollection<TurfWarNode | undefined>,
		public rankedOpen: PoppingTimePeriodCollection<RankedOpenNode | undefined>,
		public rankedSeries: PoppingTimePeriodCollection<RankedSeriesNode | undefined>,
		public xBattle: PoppingTimePeriodCollection<XBattleNode | undefined>,
		public salmonRun: PoppingTimePeriodCollection<SalmonRunNode>,
		public splatfestPro: PoppingTimePeriodCollection<SplatfestProNode | undefined>,
		public splatfestOpen: PoppingTimePeriodCollection<SplatfestOpenNode | undefined>,
		public bigRun: PoppingTimePeriodCollection<BigRunNode | undefined>,
		public eggstraWork: PoppingTimePeriodCollection<EggstraWorkNode | undefined>,
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
			fetched.splatfestPro,
			fetched.splatfestOpen,
			fetched.bigRun,
			fetched.eggstraWork,
			fetched.currentFest,
			fetched.startTime,
			fetched.endTime,
			fetched.salmonStartTime,
			fetched.salmonEndTime,
			!fetched.wasCached,
			fetched.salmonRunChanged,
		);
		logger.info("rotations instantiated, cached:", fetched.wasCached);
		logger.info(
			"Time until next rotation fetch",
			formatTime((rotations.endTime.getTime() - new Date().getTime()) / 1000),
		);
		setTimeout(function timeout() {
			void (async () => {
				const fetched = await Rotations.fetch();
				logger.info("rotations fetched, cached:", fetched.wasCached);
				rotations.applyRotations(fetched);
				await parallel(rotations.notifyChanged(), fetched.salmonRunChanged && rotations.notifySalmonChanged());
				setTimeout(timeout, rotations.endTime.getTime() - new Date().getTime());
			})();
		}, fetched.endTime.getTime() - new Date().getTime());
		return rotations;
	}
	public async notifyChanged() {
		await parallel(...[...this.hooks.values()].map(async (v) => await v()));
	}
	public async notifySalmonChanged() {
		await parallel(...[...this.salmonHooks.values()].map(async (v) => await v()));
	}
	public async forceUpdate() {
		const fetched = await Rotations.fetch(true);
		this.applyRotations(fetched);
	}

	public hook(func: () => Awaitable<void>) {
		this.hooks.add(func);
		if (this.catchingUp) void func();
	}
	public hookSalmon(func: () => Awaitable<void>) {
		this.salmonHooks.add(func);
		if (this.catchingUpSalmonRun) void func();
	}
	public static async fetchSalmonRunGear(): Promise<SalmonRunAPI.MonthlyGear> {
		const [cachedGearMonth, cachedGear] = await database.getCachedSalmonRunGear();
		logger.info("salmon run gear fetched, cached:", cachedGearMonth === new Date().getMonth() && !!cachedGear);
		if (cachedGearMonth === new Date().getMonth() && cachedGear) {
			const validationResult = SalmonRunAPI.monthlyGearSchema.safeParse(cachedGear);
			if (!validationResult.success)
				reportSchemaFail(
					"Cached Salmon Run",
					"SalmonRunAPI.monthlyGearSchema.safeParse(cachedGear)",
					validationResult.error,
				);
			return cachedGear;
		}
		const response = (
			await request("https://splatoon3.ink/data/coop.json", {
				headers: { "User-Agent": USER_AGENT },
			})
		).expect("Failed to fetch salmon run gear data");
		// validate response
		const validationResult = SalmonRunAPI.responseSchema.safeParse(response);
		if (!validationResult.success)
			reportSchemaFail(
				"Fetched Salmon Run",
				"SalmonRunAPI.responseSchema.safeParse(response.data)",
				validationResult.error,
			);

		const monthlyGear = (validationResult.success ? validationResult.data : (response as SalmonRunAPI.Response))
			.data.coopResult.monthlyGear;
		await database.setCachedSalmonRunGear(monthlyGear);
		return monthlyGear;
	}

	private static async fetch(ignoreCache = false): Promise<FetchedRotations> {
		if (process.env.NODE_ENV === "test")
			return {
				splatfestOpen: new PoppingTimePeriodCollection([]),
				splatfestPro: new PoppingTimePeriodCollection([]),
				challenges: new PoppingTimePeriodCollection([]),
				turfWar: new PoppingTimePeriodCollection([]),
				rankedOpen: new PoppingTimePeriodCollection([]),
				rankedSeries: new PoppingTimePeriodCollection([]),
				xBattle: new PoppingTimePeriodCollection([]),
				salmonRun: new PoppingTimePeriodCollection([]),
				bigRun: new PoppingTimePeriodCollection([]),
				eggstraWork: new PoppingTimePeriodCollection([]),
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
				await request("https://splatoon3.ink/data/schedules.json", {
					headers: {
						"User-Agent": USER_AGENT,
					},
				})
			).expect("Failed to fetch new rotations");
		// validate with zod
		const validationResult = SchedulesAPI.responseSchema.safeParse(response);
		if (!validationResult.success)
			reportSchemaFail("Schedules", "SchedulesAPI.responseSchema.safeParse()", validationResult.error);
		const data = validationResult.success ? validationResult.data : (response as SchedulesAPI.Response);
		const {
			data: {
				regularSchedules: { nodes: rawTurfWar },
				bankaraSchedules: { nodes: rawRanked },
				xSchedules: { nodes: rawXBattle },
				eventSchedules: { nodes: rawChallenges },
				coopGroupingSchedule: {
					regularSchedules: { nodes: rawSalmonRun },
					bigRunSchedules: { nodes: rawBigRun },
					teamContestSchedules: { nodes: rawEggstraWork },
				},
				festSchedules: { nodes: rawSplatfest },
				vsStages: { nodes: vsStages },
				currentFest: rawCurrentFest,
			},
		} = data;

		const challenges = new PoppingTimePeriodCollection(
			rawChallenges.map((x) =>
				x.leagueMatchSetting && x.timePeriods.length > 0
					? new ChallengeNode(x, x.leagueMatchSetting, vsStages)
					: undefined,
			),
		);
		const turfWar = new PoppingTimePeriodCollection(
			rawTurfWar.map((x) =>
				x.regularMatchSetting ? new TurfWarNode(x, x.regularMatchSetting, vsStages) : undefined,
			),
		);
		const rankedOpen = new PoppingTimePeriodCollection(
			rawRanked.map((x) =>
				x.bankaraMatchSettings ? new RankedOpenNode(x, x.bankaraMatchSettings[1], vsStages) : undefined,
			),
		);
		const rankedSeries = new PoppingTimePeriodCollection(
			rawRanked.map((x) =>
				x.bankaraMatchSettings ? new RankedSeriesNode(x, x.bankaraMatchSettings[0], vsStages) : undefined,
			),
		);
		const xBattle = new PoppingTimePeriodCollection(
			rawXBattle.map((x) => (x.xMatchSetting ? new XBattleNode(x, x.xMatchSetting, vsStages) : undefined)),
		);
		const salmonRun = new PoppingTimePeriodCollection(rawSalmonRun.map((x) => new SalmonRunNode(x, x.setting)));
		const bigRun = new PoppingTimePeriodCollection(rawBigRun.map((x) => new BigRunNode(x, x.setting)));
		const eggstraWork = new PoppingTimePeriodCollection(
			rawEggstraWork.map((x) => new EggstraWorkNode(x, x.setting)),
		);
		const splatfestPro = new PoppingTimePeriodCollection(
			rawSplatfest.map((x) =>
				x.festMatchSettings ? new SplatfestProNode(x, x.festMatchSettings[0], vsStages) : undefined,
			),
		);
		const splatfestOpen = new PoppingTimePeriodCollection(
			rawSplatfest.map((x) =>
				x.festMatchSettings ? new SplatfestOpenNode(x, x.festMatchSettings[1], vsStages) : undefined,
			),
		);
		const currentFest = rawCurrentFest ? new CurrentFest(rawCurrentFest) : undefined;
		// gets the earliest normal rotation endTime
		const startTime = new Date(
			Math.min(...[turfWar, splatfestPro, splatfestOpen].flatMap((x) => x.active?.startTime.getTime() ?? [])),
		);
		const endTime = new Date(
			Math.min(...[turfWar, splatfestPro, splatfestOpen].flatMap((x) => x.active?.endTime.getTime() ?? [])),
		);
		const salmonStartTime = new Date(
			Math.min(...[salmonRun, bigRun, eggstraWork].flatMap((x) => x.active?.endTime.getTime() ?? [])),
		);
		const salmonEndTime = new Date(
			Math.min(...[salmonRun, bigRun, eggstraWork].flatMap((x) => x.active?.endTime.getTime() ?? [])),
		);
		const lastSalmonEndTime = await database.getSalmonRunEndTime();
		if (!cached)
			await parallel(database.setCachedMapRotation(endTime, data), database.setSalmonRunEndTime(salmonEndTime));
		return {
			splatfestOpen,
			splatfestPro,
			challenges,
			turfWar,
			rankedOpen,
			rankedSeries,
			xBattle,
			salmonRun,
			bigRun,
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
