import type {
	Awaitable,
	InteractionReplyOptions,
	Message,
	MessageCreateOptions,
	MessageEditOptions,
	Role,
	TextChannel,
	User,
	WebhookMessageCreateOptions,
} from "discord.js";
import { Collection, EmbedBuilder, GuildMember, TimestampStyles, codeBlock, normalizeArray, time } from "discord.js";
import levenshtein from "js-levenshtein";
import type EventEmitter from "node:events";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type { Sharp } from "sharp";
import sharp from "sharp";
import type Client from "./client.js";
import database from "./database.js";

export type StrictOmit<T extends Record<string, unknown>, K extends keyof T> = Omit<T, K>;

export type StrictExclude<T, K extends T> = Exclude<T, K>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyFunction = (...args: any[]) => any;

export const SMALLEST_DATE = new Date(-8640000000000000);
export const LARGEST_DATE = new Date(8640000000000000);

/**
 * @link https://urlregex.com/
 */
export const LINK_REGEX =
	/((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=+$,\w]+@)?[A-Za-z0-9.-]+|(?:www\.|[-;:&=+$,\w]+@)[A-Za-z0-9.-]+)((?:\/[+~%/.\w\-_]*)?\??(?:[-+=&;%@.\w_]*)#?(?:[.!/\\\w]*))?)/;

/**
 * Pauses the program for the specified amount of time.
 * @param delay how many **seconds** (not milliseconds) it should wait
 */
export function wait(delay: number): Promise<void> {
	return new Promise((resolve) => setTimeout(() => resolve(), delay * 1000));
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
export function iteratorToArray<T>(iter: IterableIterator<T>): T[] {
	const out: T[] = [];
	for (const x of iter) {
		out.push(x);
	}
	return out;
}

export type EmbedFactory = (b: EmbedBuilder) => Awaitable<EmbedBuilder>;
export type OptionalEmbedFactory = (b: EmbedBuilder) => Awaitable<EmbedBuilder | false | undefined>;

export async function embeds(...funcs: OptionalEmbedFactory[]) {
	// the || operator catches `false` and `undefined`
	/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
	return {
		embeds: (
			await parallel(funcs.map(async (func) => (await func(new EmbedBuilder().setColor("#2b2d31"))) || []))
		).flat(),
	} satisfies InteractionReplyOptions;
	/* eslint-enable @typescript-eslint/prefer-nullish-coalescing */
}
export function constructEmbedsWrapper(baseFactory: EmbedFactory): typeof embeds {
	return async (...funcs) =>
		await embeds(...funcs.map<OptionalEmbedFactory>((v) => async (b) => v(await baseFactory(b))));
}
export function errorEmbeds(...data: { title: string; description: string }[]) {
	// I guess it got a little too much for ts to imply the types
	return embeds(
		...data.map<EmbedFactory>(
			(v) => (b) =>
				b
					.setTitle(`An error occurred 😭`)
					.setDescription(
						`### ${v.title}\n${codeBlock(v.description.replace(/(?<=\().*(?=splatsquad-bot)/gm, ""))}`,
					)
					.setColor("Red")
					.setTimestamp(new Date()),
		),
	);
}

export function pluralize(word: string, count: number): string {
	return `${word}${count === 1 ? "" : "s"}`;
}

export function formatTime(totalSeconds: number): string {
	const parts: string[] = [];
	const hours = Math.floor(Math.abs(totalSeconds) / 60 / 60);
	const minutes = Math.floor(Math.abs(totalSeconds) / 60);
	const seconds = Math.floor(Math.abs(totalSeconds));
	if (hours > 0) parts.push(`${hours}h`);
	if (minutes % 60 > 0) parts.push(`${minutes % 60}m`);
	if (seconds % 60 > 0 || Math.abs(totalSeconds) < 60) parts.push(`${seconds % 60}s`);
	if (totalSeconds < 0) parts.push("ago");

	return parts.join(" ");
}
export function futureTimestamp(inXSeconds: number, from = new Date()) {
	return time(new Date(from.getTime() + inXSeconds * 1000), TimestampStyles.RelativeTime);
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

export async function updateStaticMessage(
	channel: TextChannel,
	id: string,
	content: string | (MessageEditOptions & MessageCreateOptions),
): Promise<Message<true>> {
	const messageId = await database.getStaticMessageId(id);
	const message = messageId && (await channel.messages.fetch(messageId).catch(() => undefined));
	if (message) {
		return await message.edit(content);
	} else {
		const message = await channel.send(content);
		await database.setStaticMessageId(id, message.id);
		return message;
	}
}
/**
 * @link https://stackoverflow.com/questions/4154969/how-to-map-numbers-in-range-099-to-range-1-01-0/4155197#4155197
 */
export function scaleNumber(val: number, src: [number, number], dst: [number, number]): number {
	return ((val - src[0]) / (src[1] - src[0])) * (dst[1] - dst[0]) + dst[0];
}

const WEBHOOK_NAME = "splatsquad-bot impersonation webhook";
export async function impersonate(
	client: Client<true>,
	user: GuildMember | User,
	channel: TextChannel,
	message: string | WebhookMessageCreateOptions,
) {
	const webhook =
		(await channel.fetchWebhooks()).find((v) => v.token !== null && v.name === WEBHOOK_NAME) ??
		(await channel.createWebhook({
			name: WEBHOOK_NAME,
			reason: "impersonation webhook",
			avatar: client.user.avatarURL({ size: 128 }),
		}));
	await webhook.send({
		...(typeof message === "string" ? { content: message } : message),
		username: `${user instanceof GuildMember ? user.displayName : user.username}`,
		avatarURL: user.displayAvatarURL({ size: 128 }),
	} satisfies WebhookMessageCreateOptions);
}
export function messageHiddenText(text: string) {
	// eslint-disable-next-line no-irregular-whitespace
	return ` ||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​|| ${text}` as const;
}

export function roleIsCategory(role: Role): boolean {
	return role.name.match(/⠀+[A-Z]/g) !== null && role.hexColor !== "#010101";
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
 * @param timeoutSeconds longest time to wait for events in seconds
 * @param event the event(s) to wait for
 * @returns a Promise that resolves when the events are emitted or times out, with the arguments of the event or an empty array
 */
export async function awaitEvent<T extends EventEmitter, E extends EventNames<T>>(
	ee: T,
	event: E[] | E,
	timeoutSeconds?: number | undefined,
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
		if (timeoutSeconds) wait(timeoutSeconds).then(onTimeout).catch(onTimeout);
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
	const width = Math.ceil(((await img.metadata()).width ?? 15.5 * 2 * size) - 15.5 * 2 * size);

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
		.substring(1)
		.match(/.{2}/g)
		?.map((x) => parseInt(x, 16)) as [number, number, number];
}

export function dedent(strings: TemplateStringsArray, ...values: unknown[]): string {
	return strings
		.reduce((acc, cur, i) => {
			// eslint-disable-next-line @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-base-to-string
			return `${acc}${values[i - 1] ?? ""}${cur}`;
		}, "")
		.replace(/^(\t| {4})+/gm, "");
}
/**
 * @link https://stackoverflow.com/a/27979933
 */
export function escapeXml(unsafe: string) {
	return unsafe.replace(/[<>&'"]/g, function (c) {
		switch (c) {
			case '<': return '&lt;';
			case '>': return '&gt;';
			case '&': return '&amp;';
			case '\'': return '&apos;';
			case '"': return '&quot;';
			default: return '';
		}
	});
}

export function membersWithRoles(roles: Role[]): Collection<string, GuildMember> {
	return roles.reduce((acc, v) => {
		return acc.intersect(v.members);
	}, roles[0]?.members ?? new Collection<string, GuildMember>());
}
export function formatNumberIntoNth(num: number): string {
	const lastDigit = num % 10;
	const secondLastDigit = Math.floor(num / 10) % 10;

	if (secondLastDigit === 1) {
		return `${num}th`;
	} else if (lastDigit === 1) {
		return `${num}st`;
	} else if (lastDigit === 2) {
		return `${num}nd`;
	} else if (lastDigit === 3) {
		return `${num}rd`;
	}
	return `${num}th`;
}
export async function parallel<T extends ((() => Promise<unknown>) | Promise<unknown> | undefined | false)[]>(
	...funcs: T | [T]
) {
	return (await Promise.all(normalizeArray(funcs).map((v) => (typeof v === "function" ? v() : v)))) as {
		-readonly [i in keyof T]: Awaited<T[i] extends (...args: unknown[]) => unknown ? ReturnType<T[i]> : T[i]>;
	};
}
/**
 * A tuple of an optional value or error.
 * @link https://doc.rust-lang.org/std/result/index.html
 */
export type Result<T, E = Error> = [T, undefined] | [undefined, E];
/**
 * Protected await, awaits x in a try catch, returns [result, undefined] or [undefined, error].
 * @param x a promise to await
 * @link https://youtu.be/ITogH7lJTyE
 * @returns `[result, undefined]` or `[undefined, error]`
 */
export async function pawait<T, E extends Error>(x: Promise<T>): Promise<Result<T, E>> {
	try {
		return [await x, undefined];
	} catch (e) {
		return [undefined, e as E];
	}
}

/**
 * Protected call, calls the function x in a try catch, returns [result, undefined] or [undefined, error].
 * @param x a function to call
 * @link https://create.roblox.com/docs/reference/engine/globals/LuaGlobals#pcall
 * @returns `[result, undefined]` or `[undefined, error]`
 */
export function pcall<P extends unknown[], R, E extends Error>(x: (...args: P) => R, ...params: P): Result<R, E> {
	try {
		return [x(...params), undefined];
	} catch (e) {
		return [undefined, e as E];
	}
}
