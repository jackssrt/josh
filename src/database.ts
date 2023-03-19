import axios from "axios";
import { existsSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { USER_AGENT } from "./client.js";
import type { SalmonRunAPIResponse } from "./types/rotationNotifier.js";
import { parallel } from "./utils.js";

interface DatabaseData {
	createdSplatfestEvent: string;
	nextMapRotation: number;
	nextSalmonRunRotation: number;
	monthlySalmonRunGearMonth: number;
	monthlySalmonRunGear: { name: string; image: string };
}

type JSONData = {
	[x in string]: string | number | boolean | JSONData;
};

class DatabaseBackend<T extends Record<K, JSONData[string]>, K extends string> {
	private replitDatabaseUrl = process.env["REPLIT_DB_URL"];
	private data: T | undefined = undefined;
	private static readonly PATH = "./database.json";
	private async load() {
		if (existsSync("./database.json"))
			this.data = JSON.parse(await readFile(DatabaseBackend.PATH, { encoding: "utf-8" })) as T;
		else this.data = {} as T;
	}
	public async get<K extends keyof T>(key: K): Promise<T[K] | undefined> {
		if (this.replitDatabaseUrl)
			try {
				return JSON.parse((await axios.get<string>(`${this.replitDatabaseUrl}/${String(key)}`)).data) as T[K];
			} catch (e) {
				return undefined;
			}
		else {
			if (this.data === undefined) await this.load();
			return this.data![key];
		}
	}
	public async set<K extends keyof T>(key: K, value: T[K]): Promise<void> {
		if (this.replitDatabaseUrl)
			await axios.post(
				this.replitDatabaseUrl,
				// typescript thinks `keyof T` can be `Symbol` for some reason
				`${encodeURIComponent(String(key))}=${encodeURIComponent(JSON.stringify(value))}`,
				{ headers: { "Content-Type": "application/x-www-form-urlencoded" } },
			);
		else {
			if (this.data === undefined) await this.load();
			this.data![key] = value;
			await writeFile(DatabaseBackend.PATH, JSON.stringify(this.data), { encoding: "utf-8" });
		}
	}
}

export class Database {
	private backend = new DatabaseBackend<DatabaseData, keyof DatabaseData>();

	async setSplatfestEventCreated(id: string) {
		await this.backend.set("createdSplatfestEvent", id);
	}
	async isSplatfestEventCreated(id: string) {
		return (await this.backend.get("createdSplatfestEvent")) === id;
	}

	async setNextMapRotation(endTime: Date) {
		await this.backend.set("nextMapRotation", endTime.getTime());
	}
	async setNextSalmonRunRotation(endTime: Date) {
		await this.backend.set("nextSalmonRunRotation", endTime.getTime());
	}
	async activeMonthlySalmonRunGear(): Promise<DatabaseData["monthlySalmonRunGear"]> {
		const [lastMonth, lastGear] = await parallel(
			this.backend.get("monthlySalmonRunGearMonth"),
			this.backend.get("monthlySalmonRunGear"),
		);
		if (lastMonth === new Date().getMonth() && lastGear) return lastGear;
		const { data: apiData } = await axios.get<SalmonRunAPIResponse>("https://splatoon3.ink/data/coop.json", {
			headers: { "User-Agent": USER_AGENT },
		});
		const {
			name,
			image: { url: image },
		} = apiData.data.coopResult.monthlyGear;
		const data = { name, image };
		await this.backend.set("monthlySalmonRunGear", data);
		await this.backend.set("monthlySalmonRunGearMonth", new Date().getMonth());
		return data;
	}
	async shouldSendSalmonRunRotation() {
		return ((await this.backend.get("nextSalmonRunRotation")) ?? 0) < new Date().getTime();
	}
	async timeTillNextMapRotationSend() {
		return ((await this.backend.get("nextMapRotation")) ?? 0) - new Date().getTime();
	}
}

export default new Database();
