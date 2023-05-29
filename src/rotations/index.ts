import axios from "axios";
import consola from "consola";
import type { Awaitable } from "discord.js";
import { USER_AGENT } from "../client.js";
import database from "../database.js";
import getEnv from "../env.js";
import type { SalmonRunAPI, SchedulesAPI } from "../types/rotationNotifier.js";
import { LARGEST_DATE, formatTime, parallel } from "../utils.js";
import {
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
	splatfest: (SplatfestNode | undefined)[];
	turfWar: (TurfWarNode | undefined)[];
	rankedOpen: (RankedOpenNode | undefined)[];
	rankedSeries: (RankedSeriesNode | undefined)[];
	xBattle: (XBattleNode | undefined)[];
	salmonRun: SalmonRunNode[];
	eggstraWork: EggstraWorkNode[];
	startTime: Date;
	endTime: Date;
	salmonStartTime: Date;
	salmonEndTime: Date;
	currentFest: CurrentFest<"FIRST_HALF" | "SECOND_HALF"> | undefined;
	wasCached: boolean;
	salmonRunChanged: boolean;
}

export class Rotations {
	private hooks = new Set<() => Awaitable<void>>();
	private salmonHooks = new Set<() => Awaitable<void>>();
	private constructor(
		public turfWar: (TurfWarNode | undefined)[],
		public rankedOpen: (RankedOpenNode | undefined)[],
		public rankedSeries: (RankedSeriesNode | undefined)[],
		public xBattle: (XBattleNode | undefined)[],
		public salmonRun: SalmonRunNode[],
		public splatfest: (SplatfestNode | undefined)[],
		public eggstraWork: (EggstraWorkNode | undefined)[],
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
		consola.log("rotations instantiated, cached:", fetched.wasCached);
		consola.info(
			"Time until next rotation fetch",
			formatTime((rotations.endTime.getTime() - new Date().getTime()) / 1000),
		);
		let lastSalmonEndTime = rotations.salmonEndTime;
		setTimeout(function timeout() {
			void (async () => {
				const fetched = await Rotations.fetch();
				consola.log("rotations fetched, cached:", fetched.wasCached);
				rotations.applyRotations(fetched);
				await parallel(
					rotations.notifyChanged(),
					rotations.salmonEndTime.getTime() !== lastSalmonEndTime.getTime() &&
						rotations.notifySalmonChanged(),
				);
				lastSalmonEndTime = rotations.salmonEndTime;
				setTimeout(timeout, rotations.endTime.getTime() - new Date().getTime());
			})();
		}, fetched.endTime.getTime() - new Date().getTime());
		return rotations;
	}
	public async notifyChanged() {
		await parallel(...this.hooks);
	}
	public async notifySalmonChanged() {
		await parallel(...this.salmonHooks);
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
		consola.log("salmon run gear fetched, cached:", cachedGearMonth === new Date().getMonth() && cachedGear);
		if (cachedGearMonth === new Date().getMonth() && cachedGear) return cachedGear;
		const response = await axios.get<SalmonRunAPI.Response>("https://splatoon3.ink/data/coop.json", {
			headers: { "User-Agent": USER_AGENT },
		});
		const monthlyGear = response.data.data.coopResult.monthlyGear;
		await database.setCachedSalmonRunGear(monthlyGear);
		return monthlyGear;
	}

	private static async fetch(ignoreCache = false): Promise<FetchedRotations> {
		if (getEnv("NODE_ENV") === "test")
			return {
				splatfest: [],
				turfWar: [],
				rankedOpen: [],
				rankedSeries: [],
				xBattle: [],
				salmonRun: [],
				eggstraWork: [],
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
				coopGroupingSchedule: {
					regularSchedules: { nodes: rawSalmonRun },
					teamContestSchedules: { nodes: rawEggstraWork },
				},
				festSchedules: { nodes: rawSplatfest },
				currentFest: rawCurrentFest,
			},
		} = response;

		const turfWar = rawTurfWar.map((x) =>
			x.regularMatchSetting ? new TurfWarNode(x, x.regularMatchSetting) : undefined,
		);
		const rankedOpen = rawRanked.map((x) =>
			x.bankaraMatchSettings ? new RankedOpenNode(x, x.bankaraMatchSettings[1]) : undefined,
		);
		const rankedSeries = rawRanked.map((x) =>
			x.bankaraMatchSettings ? new RankedSeriesNode(x, x.bankaraMatchSettings[0]) : undefined,
		);
		const xBattle = rawXBattle.map((x) => (x.xMatchSetting ? new XBattleNode(x, x.xMatchSetting) : undefined));
		const salmonRun = rawSalmonRun.map((x) => new SalmonRunNode(x, x.setting));
		const eggstraWork = rawEggstraWork.map((x) => new EggstraWorkNode(x, x.setting));
		const splatfest = rawSplatfest.map((x) =>
			x.festMatchSetting ? new SplatfestNode(x, x.festMatchSetting) : undefined,
		);
		const currentFest = rawCurrentFest ? new CurrentFest(rawCurrentFest) : undefined;
		// gets the earliest normal rotation endTime
		[turfWar, rankedOpen, rankedSeries, xBattle, salmonRun, splatfest, eggstraWork].forEach((v) => {
			if (v.length === 0 || v[0] === undefined) return;
			while (v[0].endTime.getTime() < new Date().getTime()) {
				// first node has ended, remove it from the array
				v.shift();
				if (v.length === 0) return;
			}
		});
		const startTime = new Date(Math.min(...[turfWar, splatfest].flatMap((x) => x[0]?.startTime.getTime() ?? [])));
		const endTime = new Date(Math.min(...[turfWar, splatfest].flatMap((x) => x[0]?.endTime.getTime() ?? [])));
		const salmonStartTime = new Date(
			Math.min(...[salmonRun, eggstraWork].flatMap((x) => x[0]?.endTime.getTime() ?? [])),
		);
		const salmonEndTime = new Date(
			Math.min(...[salmonRun, eggstraWork].flatMap((x) => x[0]?.endTime.getTime() ?? [])),
		);
		const lastSalmonEndTime = await database.getSalmonRunEndTime();
		if (!cached)
			await parallel(
				database.setCachedMapRotation(endTime, response),
				database.setSalmonRunEndTime(salmonEndTime),
			);
		return {
			splatfest,
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
	private applyRotations(rotations: Awaited<ReturnType<(typeof Rotations)["fetch"]>>) {
		this.turfWar = rotations.turfWar;
		this.rankedOpen = rotations.rankedOpen;
		this.rankedSeries = rotations.rankedSeries;
		this.xBattle = rotations.xBattle;
		this.salmonRun = rotations.salmonRun;
		this.splatfest = rotations.splatfest;
		this.eggstraWork = rotations.eggstraWork;
		this.currentFest = rotations.currentFest;
		this.startTime = rotations.startTime;
		this.endTime = rotations.endTime;
		this.salmonStartTime = rotations.salmonStartTime;
		this.salmonEndTime = rotations.salmonEndTime;
		this.catchingUp = false;
	}
}
const rotations = await Rotations.new();
export default rotations;
