import type {
	Awaitable,
	Channel,
	InteractionReplyOptions,
	Message,
	MessageCreateOptions,
	MessageEditOptions,
	RepliableInteraction,
	Role,
	TextBasedChannel,
	TextChannel,
	User,
	Webhook,
	WebhookMessageCreateOptions,
} from "discord.js";
import {
	Collection,
	EmbedBuilder,
	GuildMember,
	MessageFlags,
	TimestampStyles,
	codeBlock,
	inlineCode,
	normalizeArray,
	time,
} from "discord.js";
import levenshtein from "js-levenshtein";
import type EventEmitter from "node:events";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { inspect } from "node:util";
import type { Sharp } from "sharp";
import sharp from "sharp";
import type { Option, Result } from "ts-results-es";
import { Err, Ok } from "ts-results-es";
import type { ZodIssue } from "zod";
import { ZodError } from "zod";
import Client from "./client.js";
import database from "./database.js";
import logger from "./logger.js";
import type { AnyFunction, defined } from "./types/utils.js";

export const SMALLEST_DATE = new Date(-8640000000000000);
export const LARGEST_DATE = new Date(8640000000000000);

/**
 * @link https://urlregex.com/
 */
export const LINK_REGEX =
	/((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=+$,\w]+@)?[A-Za-z0-9.-]+|(?:www\.|[-;:&=+$,\w]+@)[A-Za-z0-9.-]+)((?:\/[+~%/.\w\-_]*)?\??(?:[-+=&;%@.\w_]*)#?(?:[.!/\\\w]*))?)/;
/**
 * A regex to remove all ansi colors from a string.
 */
// eslint-disable-next-line no-control-regex
export const COLORS_REGEX = /\u001b\[(.*?)m/g;

export type Maybe<T> = T | false | undefined;

/**
 * Custom type guard for checking if a value is an error.
 * @param e the thing to test
 * @returns e is Error
 */
export function isError(e: unknown): e is Error {
	return e instanceof Error;
}

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

export function truncateString(text: string, maxLength: number) {
	maxLength = Math.max(maxLength, 3);
	return text.length > maxLength ? text.slice(0, maxLength - 3) + "..." : text;
}

export type EmbedFactory = (b: EmbedBuilder) => Awaitable<EmbedBuilder>;
export type OptionalEmbedFactory = (b: EmbedBuilder) => Awaitable<Maybe<EmbedBuilder>>;

export async function embeds(...funcs: OptionalEmbedFactory[]) {
	return {
		embeds: (
			await parallel(funcs.map(async (func) => (await func(new EmbedBuilder().setColor("#2b2d31"))) || []))
		).flat(),
	} satisfies InteractionReplyOptions;
}
export function constructEmbedsWrapper(baseFactory: EmbedFactory): typeof embeds {
	return async (...funcs) =>
		await embeds(...funcs.map<OptionalEmbedFactory>((v) => async (b) => v(await baseFactory(b))));
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

export type ErrorData = {
	title: string;
	affectedUser?: GuildMember | User | undefined;
	interaction?: RepliableInteraction | undefined;
	description?: string | undefined;
	error?: Error | undefined;
};

function formatIssues(issues: ZodIssue[], indentLevel = 0): string[] {
	return issues
		.map((v) => [
			`${"\xa0".repeat(indentLevel * 4)}${v.path.join(".")}: ${v.code}, ${v.message}`,
			v.code === "invalid_union"
				? v.unionErrors.map((v, i) => [i !== 0 ? "----" : [], formatIssues(v.errors, indentLevel + 1)])
				: [],
		])
		.flat(4);
}
async function reportErrorInner(
	client: Client<true>,
	{ title, description, error, affectedUser, interaction }: ErrorData,
) {
	const parts = ["Error reported:", title];
	if (description) parts.push(description);
	if (error) parts.push(inspect(error, { depth: 1 }));
	logger.error(parts.join("\n"));
	const embed = await embeds((b) => {
		if (affectedUser) {
			const url = affectedUser.displayAvatarURL();
			b.setAuthor({
				...(url ? { iconURL: url } : {}),
				name: `@${affectedUser instanceof GuildMember ? affectedUser.user.username : affectedUser.username}`,
			});
		}
		return b
			.setColor("#ff0000")
			.setTitle(title)
			.setDescription(
				truncateString(
					dedent`${description}
				${
					error
						? codeBlock(
								"ts",
								error instanceof ZodError
									? formatIssues(error.issues).join("\n")
									: error.stack?.replace(/(?<=\().*(?=josh)/gm, "") ??
											`${error.name}(${error.message})`,
							)
						: ""
				}`.trim(),
					4096,
				),
			)
			.setFooter({ text: "An error occurred 😭" })
			.setTimestamp(new Date());
	});
	// send error to owner,
	// reply or edit, and if it doesn't work: send to user in dms
	const result = await pawait(
		parallel((affectedUser?.id ?? "") !== client.owner.id && client.owner.send(embed), async () => {
			if (
				interaction &&
				(
					await pawait(
						interaction.replied
							? interaction.editReply({ ...embed, content: "", components: [], files: [] })
							: interaction.reply({ ...embed, components: [], files: [], ephemeral: true }),
					)
				).isOk()
			)
				return;
			await affectedUser?.send(embed);
		}),
	);
	if (result.isErr())
		logger.error(
			`Failed to send error report: ${title}\n${embed.embeds[0]?.data.description}\n<@${affectedUser?.id}>`,
		);
}
export function reportError(data: ErrorData) {
	// wait for client to be ready
	void (async () => {
		await Client.loadedSyncSignal.await();
		await reportErrorInner(Client.instance!, data);
	})();
}

export function reportSchemaFail(name: string, code: string, error: ZodError) {
	reportError({
		title: `${name} API response failed schema validation`,
		error,
		description: dedent`${inlineCode(code)} failed, this may be caused by:
				- Incorrect schema design
				- The API changing
				The invalid data will still be used, this is just a forewarning.`,
	});
}

type WebhookableChannel = Extract<TextBasedChannel, { fetchWebhooks: defined }>;

const WEBHOOK_NAME = "josh impersonation webhook";
export async function impersonate(
	client: Client<true>,
	user: GuildMember | User,
	channel: WebhookableChannel,
	message: string | WebhookMessageCreateOptions,
): Promise<[Message, Webhook]> {
	const webhook =
		(await channel.fetchWebhooks()).find((v) => v.token !== null && v.name === WEBHOOK_NAME) ??
		(await channel.createWebhook({
			name: WEBHOOK_NAME,
			reason: "impersonation webhook",
			avatar: client.user.displayAvatarURL({ size: 128 }),
		}));
	return [
		await webhook.send({
			avatarURL: user.displayAvatarURL({ size: 128 }),
			username: `${user instanceof GuildMember ? user.displayName : user.username}`,
			allowedMentions: { parse: [] },
			...(typeof message === "string" ? { content: message } : message),
		} satisfies WebhookMessageCreateOptions),
		webhook,
	];
}

export function canReplaceMessage(message: Message): message is ReplaceableMessage {
	return message.inGuild() && !!(message.channel as Channel & WebhookableChannel).fetchWebhooks;
}

type ReplaceableMessage = Message<true> & { channel: WebhookableChannel };

export async function replaceMessage(
	client: Client<true>,
	message: ReplaceableMessage,
	newData: string | WebhookMessageCreateOptions,
): Promise<[Message, Webhook]> {
	return (
		await parallel(
			message.deletable && message.delete(),
			impersonate(client, message.member ?? message.author, message.channel, {
				flags: MessageFlags.SuppressNotifications,
				allowedMentions: {
					parse: [],
				},
				...(typeof newData === "string" ? { content: newData } : newData),
			}),
		)
	)[1];
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
export async function awaitEvent<T extends EventEmitter, E extends string | symbol = EventNames<T>>(
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
	// early return for empty search term
	if (!term.trim().length) return source;
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

export type Uncallable<T> = T extends AnyFunction ? never : T;

export function fillArray<T>(count: number, value: Uncallable<T> | ((i: number) => T)): T[] {
	const array = new Array<T>(count);
	// checked early for performance, value doesn't change value between each item
	// prettier-ignore
	if (typeof value === "function")
		for (let i = 0; i < count; i++)
			array[i] = (value as (i: number) => T)(i);
	else
		for (let i = 0; i < count; i++)
			array[i] = value
	return array;
}
export async function fillArrayAsync<T>(count: number, creator: (i: number) => Promise<T>): Promise<T[]> {
	return await parallel(fillArray(count, creator));
}

export async function textImage(text: string, color: string, size: number): Promise<Sharp> {
	// adding "Dg" forces the text image to be as tall as possible,
	const img = sharp({
		text: {
			text: `<span foreground="${color}">Dg ${escapeXml(text)} Dg</span>`,
			dpi: 72 * size,
			font: "Splatoon2",
			rgba: true,
		},
	});
	const metadata = await img.metadata();
	const width = Math.ceil((metadata.width ?? 15.5 * 2 * size) - 15.5 * 2 * size);

	const height = metadata.height ?? 0;
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
export function truncate(limit: number, string: string) {
	return string.substring(0, Math.min(limit, string.length));
}

/**
 * @link https://stackoverflow.com/a/27979933
 */
export function escapeXml(unsafe: string) {
	return unsafe.replace(/[<>&'"]/g, function (c) {
		switch (c) {
			case "<":
				return "&lt;";
			case ">":
				return "&gt;";
			case "&":
				return "&amp;";
			case "'":
				return "&apos;";
			case '"':
				return "&quot;";
			default:
				return "";
		}
	});
}

export function membersWithRoles(roles: Role[]): Collection<string, GuildMember> {
	return roles.reduce(
		(acc, v) => {
			return acc.intersect(v.members);
		},
		roles[0]?.members ?? new Collection<string, GuildMember>(),
	);
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
		-readonly [i in keyof T]: Awaited<T[i] extends (...args: unknown[]) => infer R ? R : T[i]>;
	};
}

export async function parallelSettled<T extends ((() => Promise<unknown>) | Promise<unknown> | undefined | false)[]>(
	...funcs: T | [T]
) {
	return (await Promise.allSettled(normalizeArray(funcs).map((v) => (typeof v === "function" ? v() : v)))) as {
		-readonly [i in keyof T]: Awaited<T[i] extends (...args: unknown[]) => infer R ? R : T[i]>;
	};
}

export function flattenOptionArray<T>(array: Option<T>[]): T[] {
	return array.reduce<T[]>((acc, v) => {
		if (v.isSome()) acc.push(v.value);
		return acc;
	}, []);
}

/**
 * Protected await, awaits x in a try catch, returns [result, undefined] or [undefined, error].
 * @param x a promise to await
 * @link https://youtu.be/ITogH7lJTyE
 * @returns Result
 */
export async function pawait<T extends PromiseLike<unknown>, E extends Error>(x: T): Promise<Result<Awaited<T>, E>> {
	try {
		return Ok(await x);
	} catch (e) {
		return Err(e as E);
	}
}

/**
 * Protected call, calls the function x in a try catch, returns [result, undefined] or [undefined, error].
 * @param x a function to call
 * @link https://create.roblox.com/docs/reference/engine/globals/LuaGlobals#pcall
 * @returns Result
 */
export function pcall<P extends unknown[], R, E extends Error>(x: (...args: P) => R, ...params: P): Result<R, E> {
	try {
		return Ok(x(...params));
	} catch (e) {
		return Err(e as E);
	}
}
export class Queue<T> {
	private elements: T[];
	private head: number;
	private tail: number;

	constructor() {
		this.elements = [];
		this.head = 0;
		this.tail = -1;
	}

	public enqueue(item: T): void {
		this.elements[++this.tail] = item;
	}

	public dequeue(): T | undefined {
		if (this.isEmpty()) {
			return undefined;
		}

		const item = this.elements[this.head];
		// this is an array, not a tuple
		// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
		delete this.elements[this.head++];
		return item;
	}

	public isEmpty(): boolean {
		return this.head > this.tail;
	}

	public clear(): void {
		this.elements = [];
		this.head = 0;
		this.tail = -1;
	}
}
