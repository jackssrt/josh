import { normalizeArray } from "discord.js";
import type { LastArrayElement } from "type-fest";
import type { Maybe, OneOrMore } from "./types.js";

export async function parallel<T extends Maybe<(() => Promise<unknown>) | Promise<unknown>>[]>(...funcs: T | [T]) {
	return (await Promise.all(normalizeArray(funcs).map((v) => (typeof v === "function" ? v() : v)))) as {
		-readonly [i in keyof T]: Awaited<T[i] extends (...args: unknown[]) => infer R ? R : T[i]>;
	};
}

export async function parallelSettled<T extends Maybe<(() => Promise<unknown>) | Promise<unknown>>[]>(
	...funcs: T | [T]
) {
	return (await Promise.allSettled(normalizeArray(funcs).map((v) => (typeof v === "function" ? v() : v)))) as {
		-readonly [i in keyof T]: Awaited<T[i] extends (...args: unknown[]) => infer R ? R : T[i]>;
	};
}

export async function parallelRace<T extends OneOrMore<Maybe<(() => Promise<unknown>) | Promise<unknown>>>>(
	...funcs: T | [T]
) {
	return (await Promise.race(
		normalizeArray(funcs).flatMap((v) => (typeof v === "function" ? v() : v instanceof Promise ? v : [])),
	)) as {
		-readonly [i in keyof T]: Awaited<
			T[i] extends (...args: unknown[]) => infer R ? R : Exclude<T[i], false | undefined>
		>;
	}[number];
}

export function sequential<T extends Maybe<() => Promise<unknown>>[]>(...funcs: T | [T]) {
	return normalizeArray(funcs).reduce(
		(acc, c) => (c ? acc.then(c) : acc),
		Promise.resolve<unknown>(undefined),
	) as LastArrayElement<T>;
}
