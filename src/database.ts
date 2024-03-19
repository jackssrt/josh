import type { Awaitable, GuildMember, PartialGuildMember, PresenceData, Snowflake } from "discord.js";
import { existsSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import type { AnnouncementData, AnnouncementDataForKey, EditableAnnouncementMessageIdType } from "./announcements.js";
import type { DatabaseOccurenceData } from "./occurrences.js";
import type * as SalmonRunAPI from "./schemas/salmonRunApi.js";
import type * as SchedulesAPI from "./schemas/schedulesApi.js";
import Lock from "./utils/Lock.js";
import { parallel } from "./utils/promise.js";
import { SMALLEST_DATE } from "./utils/time.js";
import type { ExtractKeys } from "./utils/types.js";

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
	"message.twitterEmbed.enabled": "true",
	"message.tiktokEmbed.enabled": "true",
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
	occurrences: Record<string, DatabaseOccurenceData>;
	announcements: { [K in string]: AnnouncementDataForKey<K> };
	announcementsMessageIds: Record<Snowflake, [`user-${string}`, EditableAnnouncementMessageIdType]>;
	replacedMessages: Record<Snowflake, Snowflake>;
	members: Record<Snowflake, number>;
};

const UPDATE_SKIP = Symbol();

class DatabaseBackend<T extends Record<string, unknown>> {
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
	public async update<K extends keyof T>(
		key: K,
		defaultValue: T[K],
		updater: (oldValue: T[K]) => Awaitable<T[K] | typeof UPDATE_SKIP>,
	) {
		const oldValue = await this.get(key, defaultValue);
		const newValue = await updater(oldValue);
		if (newValue !== UPDATE_SKIP) await this.set(key, newValue);
	}
	public async setRecordKey<K extends ExtractKeys<T, Record<string, unknown>>>(
		databaseKey: K,
		key: keyof T[K],
		value: T[K][keyof T[K]],
	) {
		// you can only pass database keys that have a type of Record<string, unknown> to this function
		// typescript can't infer that T[K] extends Record<string, unknown>
		await this.update(
			databaseKey,
			{} as T[K] & Record<string, unknown>,
			(oldValue) =>
				({
					...(oldValue as T[K] & Record<string, unknown>),
					[key]: value,
				}) as T[K] & Record<string, unknown>,
		);
	}
	public async deleteRecordKey<K extends ExtractKeys<DatabaseData, Record<string, unknown>> & keyof T>(
		databaseKey: K,
		key: keyof T[K],
	) {
		// you can only pass database keys that have a type of Record<string, unknown> to this function
		// typescript can't infer that T[K] extends Record<string, unknown>
		await this.update(databaseKey, {} as T[K] & Record<string, unknown>, (oldValue) => {
			// oldValue is a Record<string, _>
			// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
			delete oldValue[key];
			return oldValue;
		});
	}
	public async appendArray<K extends ExtractKeys<T, unknown[]>>(databaseKey: K, value: T[K][keyof T[K]]) {
		// you can only pass database keys that have a type of unknown[] to this function
		// typescript can't infer that T[K] extends unknown[]
		await this.update(
			databaseKey,
			[] as T[K] & unknown[],
			(oldValue) => [...(oldValue as T[K] & unknown[]), value] as T[K] & unknown[],
		);
	}
}

const madeChallengeEventsLock = new Lock();

export class Database {
	private readonly backend = new DatabaseBackend<DatabaseData>();

	// Splatfest Events
	public async setSplatfestEventCreated(name: string) {
		await this.backend.set("createdSplatfestEvent", name);
	}
	public async isSplatfestEventCreated(name: string) {
		return (await this.backend.get("createdSplatfestEvent")) === name;
	}

	// Rotations
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

	// Challenge Events
	// TODO serialize a set and use that
	public async shouldMakeChallengeEvent(id: string): Promise<boolean> {
		return !(await this.backend.get("madeChallengeEvents", [])).includes(id);
	}
	public async setMadeChallengeEvent(id: string) {
		await madeChallengeEventsLock.lock(async () => await this.backend.appendArray("madeChallengeEvents", id));
	}

	// Static Messages
	public async getStaticMessageId(id: string): Promise<Snowflake | undefined> {
		return (await this.backend.get("staticMessageIds", {}))[id];
	}
	public async setStaticMessageId(id: string, messageId: Snowflake) {
		await this.backend.setRecordKey("staticMessageIds", id, messageId);
	}
	public async deleteStaticMessageId(id: string) {
		await this.backend.deleteRecordKey("staticMessageIds", id);
	}

	// Invite Records
	public async setInviteRecord(inviter: Snowflake, invitee: Snowflake) {
		await this.backend.setRecordKey("inviteRecords", invitee, inviter);
	}
	public async getInviteRecord(): Promise<Record<Snowflake, Snowflake>> {
		return await this.backend.get("inviteRecords", {});
	}

	// Flags
	public async setFlag<T extends Flag>(flag: T, value: (typeof DEFAULT_FLAGS)[T]) {
		await this.backend.setRecordKey("flags", flag, value);
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

	// Active Presence
	public async getActivePresence(): Promise<PresenceData | undefined> {
		return await this.backend.get("activePresence");
	}
	public async setActivePresence(presence: PresenceData) {
		await this.backend.set("activePresence", presence);
	}

	// Occurrences
	public async getOccurrenceById(id: string): Promise<DatabaseOccurenceData | undefined> {
		return (await this.backend.get("occurrences", {}))[id];
	}
	public async saveOccurrence(id: string, data: DatabaseOccurenceData) {
		await this.backend.setRecordKey("occurrences", id, data);
	}

	// Announcements
	public async getAnnouncement<T extends string>(id: T) {
		return (await this.backend.get("announcements", {}))[id] as AnnouncementDataForKey<T>;
	}
	public async setAnnouncement(id: string, data: AnnouncementData) {
		await this.backend.setRecordKey("announcements", id, data);
	}
	public async getAnnouncementByMessageId(messageId: string) {
		return (await this.backend.get("announcementsMessageIds", {}))[messageId];
	}
	public async linkMessageIdToAnnouncementSource(
		messageId: string,
		id: `user-${string}`,
		type: EditableAnnouncementMessageIdType,
	) {
		await this.backend.setRecordKey("announcementsMessageIds", messageId, [id, type]);
	}
	public async unlinkMessageIdFromAnnouncementSource(messageId: string) {
		await this.backend.deleteRecordKey("announcementsMessageIds", messageId);
	}
	public async getAllAnnouncementIds() {
		return Object.keys(await this.backend.get("announcements", {}));
	}
	public async deleteAnnouncement(id: string) {
		await this.backend.deleteRecordKey("announcements", id);
	}

	// Replaced messages
	public async setReplacedMessage(messageId: Snowflake, authorId: Snowflake) {
		await this.backend.setRecordKey("replacedMessages", messageId, authorId);
	}
	public async getReplacedMessage(messageId: Snowflake) {
		return (await this.backend.get("replacedMessages", {}))[messageId];
	}
	public async deleteReplacedMessage(messageId: Snowflake) {
		await this.backend.deleteRecordKey("replacedMessages", messageId);
	}

	// Members
	public async addMember(member: GuildMember) {
		await this.backend.update("members", {}, (old) => {
			if (old[member.id] === undefined) {
				old[member.id] = Object.keys(old).length;
				return old;
			} else {
				return UPDATE_SKIP;
			}
		});
	}
	public async getMemberList() {
		return await this.backend.get("members", {});
	}
	public async getMemberIndex(member: GuildMember | PartialGuildMember) {
		return (await this.backend.get("members", {}))[member.id];
	}
}

export default new Database();
