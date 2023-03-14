import type {
	Awaitable,
	InteractionReplyOptions,
	Role,
	TextChannel,
	User,
	WebhookMessageCreateOptions,
} from "discord.js";
import { EmbedBuilder, GuildMember, TimestampStyles } from "discord.js";
import levenshtein from "js-levenshtein";
import type EventEmitter from "node:events";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type { Sharp } from "sharp";
import sharp from "sharp";
import type Client from "./client.js";
export interface Config {
	token: string;
	guildId: string;
	clientId: string;
	generalChannelId: string;
	levelUpChannelId: string;
	ownerId: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyFunction = (...args: any[]) => any;

/**
 * Pauses the program for the specified amount of time.
 * @param delay how many **seconds** (not milliseconds) it should wait
 */
export function wait(delay: number) {
	return new Promise<void>((resolve) => setTimeout(() => resolve(), delay * 1000));
}

/**
 * Loads a json file.
 * @param path the path to the json file
 * @returns the loaded json file
 * @throws if the file doesn't exist
 */
export async function loadJson<T>(path: string, reviver?: Parameters<JSON["parse"]>[1]): Promise<T> {
	if (existsSync(path)) {
		try {
			const data = (await readFile(path, { encoding: "utf-8" })).replace(/(\/\/.*)|(\/\*(.|[\n\r])*\*\/)/gm, "");
			return JSON.parse(data, function (this: unknown, key: string, value: unknown) {
				const res: unknown = reviver?.(key, value);
				return reviver ? res : value;
			}) as T;
		} catch (e) {
			throw new Error(`Failed to read ${path} (${(e as Error).name} - ${(e as Error).message})`);
		}
	} else {
		throw new Error(`File ${path} does not exist.`);
	}
}
export async function generatorToArray<T>(gen: AsyncGenerator<T>): Promise<T[]> {
	const out: T[] = [];
	for await (const x of gen) {
		out.push(x);
	}
	return out;
}
export type EmbedFactory = (b: EmbedBuilder) => Awaitable<EmbedBuilder>;

export async function embeds(...funcs: EmbedFactory[]) {
	return {
		embeds: await Promise.all(funcs.map(async (func) => await func(new EmbedBuilder().setColor("#2b2d31")))),
	} satisfies InteractionReplyOptions;
}
export function constructEmbedsWrapper(baseFactory: EmbedFactory): typeof embeds {
	return async (...funcs) => await embeds(...funcs.map<EmbedFactory>((v) => async (b) => v(await baseFactory(b))));
}
export function errorEmbeds(...data: { title: string; description: string }[]) {
	// I guess it got a little too much for ts to imply the types
	return embeds(
		...data.map<EmbedFactory>(
			(v) => (b) => b.setTitle(`Error: ${v.title}`).setDescription(v.description).setColor("Red"),
		),
	);
}

export function pluralize(word: string, count: number | bigint): string {
	return (
		word + ((typeof count === "bigint" && count === 1n) || (typeof count === "number" && count === 1) ? "" : "s")
	);
}

export function formatTime(totalSeconds: number | bigint): string {
	const parts: string[] = [];
	if (typeof totalSeconds === "number") {
		const hours = Math.floor(totalSeconds / 60 / 60);
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = Math.floor(totalSeconds);
		if (hours > 0) parts.push(`${hours}h`);
		if (minutes % 60 > 0) parts.push(`${minutes % 60}m`);
		if (seconds % 60 > 0 || totalSeconds < 60) parts.push(`${seconds % 60}s`);
	} else {
		const hours = totalSeconds / 60n / 60n;
		const minutes = totalSeconds / 60n;
		const seconds = totalSeconds;
		if (hours > 0n) parts.push(`${hours}h`);
		if (minutes % 60n > 0n) parts.push(`${minutes % 60n}m`);

		if (seconds % 60n > 0n || totalSeconds < 60) parts.push(`${seconds % 60n}s`);
	}
	return parts.join(" ");
}
export function futureTimestamp(inXSeconds: number, from = new Date()) {
	return relativeTimestamp(new Date(from.getTime() + inXSeconds * 1000));
}
export function relativeTimestamp(date: Date) {
	return `<t:${Math.floor(date.getTime() / 1000)}:${TimestampStyles.RelativeTime}>` as const;
}
export function dateTimestamp(date: Date) {
	return `<t:${Math.floor(date.getTime() / 1000)}:${TimestampStyles.ShortDate}>` as const;
}
export function timeTimestamp(date: Date, includeSeconds: boolean) {
	return `<t:${Math.floor(date.getTime() / 1000)}:${
		includeSeconds ? TimestampStyles.LongTime : TimestampStyles.ShortTime
	}>` as const;
}
/**
 * @link https://stackoverflow.com/a/12646864
 */
export function getRandomValues<T extends unknown[]>(arr: T, count: number): T[number][] {
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}

	return arr.slice(0, count);
}

const WEBHOOK_NAME = "splatsquad-bot impersonation webhook";
export async function impersonate(
	client: Client<true>,
	user: GuildMember | User,
	channel: TextChannel,
	message: string | WebhookMessageCreateOptions,
) {
	const webhook =
		(await channel.fetchWebhooks()).find((v) => v.token !== undefined && v.name === WEBHOOK_NAME) ??
		(await channel.createWebhook({
			name: WEBHOOK_NAME,
			reason: "impersonation webhook",
			avatar: client.user.avatarURL({ size: 128 }),
		}));
	await webhook.send({
		...(typeof message === "string" ? { content: message } : message),
		username: `${user instanceof GuildMember ? user.nickname ?? user.user.username : user.username}`,
		avatarURL: user.displayAvatarURL({ size: 128 }),
	} satisfies WebhookMessageCreateOptions);
}
export function messageHiddenText(text: string) {
	// eslint-disable-next-line no-irregular-whitespace
	return ` ||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​|| ${text}` as const;
}

export function shortenStageName(stage: string): string {
	return ["Wahoo World", "Scorch Gorge", "Flounder Heights", "Um'ami Ruins", "Manta Maria"].includes(stage)
		? stage
		: stage.split(" ")[0]!;
}

export function roleIsCategory(role: Role): boolean {
	return role.name.startsWith("⠀") && role.hexColor !== "#010101";
}

/**
 * Gets all the roles that are under the anchor role in the same category.
 * @param anchor The anchor role
 * @returns Roles that are under the anchor role in the same category
 */
export async function getLowerRolesInSameCategory(anchor: Role) {
	const roles: Role[] = [];
	let collecting = false;
	for (const v of (await anchor.guild.roles.fetch()).sort((a, b) => b.position - a.position).values()) {
		if (v.name === "@everyone") continue;
		if (collecting) {
			if (roleIsCategory(v)) collecting = false;
			else roles.push(v);
		} else {
			if (v.id === anchor.id) collecting = true;
		}
	}
	return roles;
}
/**
 * Get the parameters of events in an eventEmitter.
 */
export type EventParams<T extends EventEmitter> = Parameters<Parameters<T["on"]>[1]>;
/**
 * Get the names of events in an eventEmitter.
 */
export type EventNames<T extends EventEmitter> = Parameters<T["on"]>[0];

/**
 * Await for an eventemitter to emit specific events.
 * Makes eventemitters able to be awaited.
 * @param ee the eventemitter
 * @param timeout longest time to wait for events
 * @param event the event(s) to wait for
 * @returns a Promise that resolves when the events are emitted or times out, with the arguments of the event or an empty array
 */
export async function awaitEvent<T extends EventEmitter, E extends EventNames<T>>(
	ee: T,
	event: E[] | E,
	timeout?: number | undefined,
): Promise<EventParams<T> | []> {
	const events = Array.isArray(event) ? event : [event];
	return new Promise((resolve) => {
		function listener(...args: unknown[]) {
			events.forEach((e) => ee.removeListener(e, listener));
			resolve(args as EventParams<T>);
		}
		events.forEach((e) => ee.on(e, listener));

		function onTimeout() {
			events.forEach((e) => ee.removeListener(e, listener));
			resolve([]);
		}
		if (timeout) wait(timeout).then(onTimeout).catch(onTimeout);
	});
}

export function search<T extends string[]>(source: T, term: string): T[number][] {
	return source.sort((a, b) => {
		const bStartsWith = b.toLowerCase().trim().startsWith(term.toLowerCase().trim());
		const aStartsWith = a.toLowerCase().trim().startsWith(term.toLowerCase().trim());
		if (aStartsWith && bStartsWith) return 0;
		else if (bStartsWith) return 1;
		else if (aStartsWith) return -1;
		const bContains = b.toLowerCase().trim().includes(term.toLowerCase().trim());
		const aContains = a.toLowerCase().trim().includes(term.toLowerCase().trim());
		if (bContains && aContains) return 0;
		else if (bContains) return 1;
		else if (aContains) return -1;

		return (
			levenshtein(a.toLowerCase().trim(), term.toLowerCase().trim()) -
			levenshtein(b.toLowerCase().trim(), term.toLowerCase().trim())
		);
	});
}
export async function textImage(text: string, color: string, size: number): Promise<Sharp> {
	// adding "Dg" forces the text image to be as tall as possible,
	const img = sharp({
		text: {
			text: `<span foreground="${color}">Dg ${text.replace("&", "&amp;")} Dg</span>`,
			dpi: 72 * size,
			font: "Splatoon2",
			rgba: true,
		},
	});
	const width = ((await img.metadata()).width ?? 14 * 2 * size) - 14 * 2 * size;

	const height = (await img.metadata()).height ?? 0;
	// cuts off the "Dg" text while keeping the height
	return img.resize(width, height).png();
}
/**
 * @link https://stackoverflow.com/a/596243
 */
export function colorLuminance(r: number, g: number, b: number): number {
	return 0.299 * r + 0.587 * g + 0.114 * b;
}
/**
 * @link https://stackoverflow.com/a/39077686
 */
export function hexToRGB(hex: `#${string}`) {
	return hex
		.replace(
			/^#?([a-f\d])([a-f\d])([a-f\d])$/i,
			(_, r: string, g: string, b: string) => "#" + r + r + g + g + b + b,
		)
		?.substring(1)
		?.match(/.{2}/g)
		?.map((x) => parseInt(x, 16)) as [number, number, number];
}
