import type { PresenceData, Snowflake } from "discord.js";
import { existsSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import Lock from "./lock.js";
import type * as SalmonRunAPI from "./types/salmonRunApi.js";
import type * as SchedulesAPI from "./types/schedulesApi.js";
import { SMALLEST_DATE, parallel } from "./utils.js";
export const DEFAULT_FLAGS = {
	"tts.voice": "gtts",
	"tts.enabled": "true",
	"tts.mutedOnly": "false",
	"tts.playFiles": "true",
	"tts.channelLock": "true",
	"log.ratelimits": "false",
	"log.events": "false",
	"log.commands": "true",
	"log.contextMenuItems": "true",
	"log.discord.warn": "false",
	"log.discord.debug": "false",
	"message.fxtwitter.enabled": "true",
	"message.tiktokDownloader.enabled": "true",
	"message.awesomeTroll.target": "",
} satisfies Record<string, string>;
export type Flag = keyof typeof DEFAULT_FLAGS;
export type DatabaseData = {
	createdSplatfestEvent: string;
	cachedMapRotation: SchedulesAPI.Response;
	cachedMapRotationExpiry: number;
	nextSalmonRunRotation: number;
	monthlySalmonRunGearMonth: number;
	monthlySalmonRunGear: SalmonRunAPI.MonthlyGear;
	madeChallengeEvents: string[];
	staticMessageIds: Record<string, Snowflake>;
	inviteRecords: Record<Snowflake, Snowflake>;
	flags: Partial<typeof DEFAULT_FLAGS>;
	activePresence: PresenceData;
};
class DatabaseBackend<T extends Record<K, unknown>, K extends string> {
	private data: T | undefined = undefined;
	private static readonly PATH = "./database.json";
	private async load() {
		if (existsSync(DatabaseBackend.PATH))
			this.data = JSON.parse(await readFile(DatabaseBackend.PATH, { encoding: "utf-8" })) as T;
		else this.data = {} as T;
	}
	public async get<K extends keyof T>(key: K): Promise<T[K] | undefined>;
	public async get<K extends keyof T>(key: K, defaultValue: T[K]): Promise<T[K]>;
	public async get<K extends keyof T>(key: K, defaultValue?: T[K]): Promise<T[K] | undefined> {
		if (this.data === undefined) await this.load();
		return this.data![key] ?? defaultValue;
	}
	public async set<K extends keyof T>(key: K, value: T[K]): Promise<void> {
		if (this.data === undefined) await this.load();
		this.data![key] = value;
		await writeFile(DatabaseBackend.PATH, JSON.stringify(this.data), { encoding: "utf-8" });
	}
}
const madeChallengeEventsLock = new Lock();
export class Database {
	private readonly backend = new DatabaseBackend<DatabaseData, keyof DatabaseData>();

	public async setSplatfestEventCreated(name: string) {
		await this.backend.set("createdSplatfestEvent", name);
	}
	public async isSplatfestEventCreated(name: string) {
		return (await this.backend.get("createdSplatfestEvent")) === name;
	}

	public async setCachedMapRotation(endTime: Date, response: SchedulesAPI.Response) {
		await parallel(
			this.backend.set("cachedMapRotation", response),
			this.backend.set("cachedMapRotationExpiry", endTime.getTime()),
		);
	}
	public async getCachedMapRotation(): Promise<SchedulesAPI.Response | undefined> {
		const expiry = await this.backend.get("cachedMapRotationExpiry", 0);
		return expiry > new Date().getTime() ? await this.backend.get("cachedMapRotation") : undefined;
	}
	public async setSalmonRunEndTime(endTime: Date) {
		await this.backend.set("nextSalmonRunRotation", endTime.getTime());
	}
	public async getSalmonRunEndTime() {
		return new Date(await this.backend.get("nextSalmonRunRotation", SMALLEST_DATE.getTime()));
	}

	public async getCachedSalmonRunGear() {
		return await parallel(this.backend.get("monthlySalmonRunGearMonth"), this.backend.get("monthlySalmonRunGear"));
	}
	public async setCachedSalmonRunGear(gear: SalmonRunAPI.MonthlyGear) {
		await parallel(
			this.backend.set("monthlySalmonRunGearMonth", new Date().getMonth()),
			this.backend.set("monthlySalmonRunGear", gear),
		);
	}
	// TODO serialize a set and use that
	public async shouldMakeChallengeEvent(id: string): Promise<boolean> {
		return !(await this.backend.get("madeChallengeEvents", [])).includes(id);
	}
	public async setMadeChallengeEvent(id: string) {
		const key = await madeChallengeEventsLock.lock();
		await this.backend.set("madeChallengeEvents", [...(await this.backend.get("madeChallengeEvents", [])), id]);
		madeChallengeEventsLock.unlock(key);
	}
	public async getStaticMessageId(id: string): Promise<Snowflake | undefined> {
		return (await this.backend.get("staticMessageIds", {}))[id];
	}
	public async setStaticMessageId(id: string, messageId: Snowflake) {
		await this.backend.set("staticMessageIds", {
			...(await this.backend.get("staticMessageIds", {})),
			[id]: messageId,
		});
	}
	public async setInviteRecord(inviter: Snowflake, invitee: Snowflake) {
		await this.backend.set("inviteRecords", { ...(await this.backend.get("inviteRecords")), [invitee]: inviter });
	}
	public async getInviteRecord(): Promise<Record<Snowflake, Snowflake>> {
		return await this.backend.get("inviteRecords", {});
	}
	public async setFlag<T extends Flag>(flag: T, value: (typeof DEFAULT_FLAGS)[T]) {
		await this.backend.set("flags", { ...(await this.backend.get("flags")), [flag]: value });
	}
	public async getAllFlags(): Promise<DatabaseData["flags"]> {
		return await this.backend.get("flags", {});
	}
	public async getFlag<T extends Flag>(flag: T): Promise<(typeof DEFAULT_FLAGS)[T]> {
		const overrides = await this.backend.get("flags", {});
		return overrides[flag] ?? DEFAULT_FLAGS[flag];
	}
	public async getBooleanFlag<T extends Flag>(flag: T): Promise<boolean> {
		return (await this.getFlag(flag)) === "true";
	}
	public async getActivePresence(): Promise<PresenceData | undefined> {
		return await this.backend.get("activePresence");
	}
	public async setActivePresence(presence: PresenceData) {
		await this.backend.set("activePresence", presence);
	}
}

export default new Database();
