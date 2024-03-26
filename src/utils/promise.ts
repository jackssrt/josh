import { normalizeArray } from "discord.js";
import type { LastArrayElement } from "type-fest";
import type { Maybe, OneOrMore } from "./types.js";

/**
 * Runs promises concurrently. This function is a bit of a misnomer...\
 * Essentially a wrapper around {@link Promise.all}
 * @param funcs A rest param or array of async functions or promises to run
 * @returns The settled values of the promises.
 */
export async function parallel<T extends Maybe<(() => Promise<unknown>) | Promise<unknown>>[]>(...funcs: T | [T]) {
	return (await Promise.all(normalizeArray(funcs).map((v) => (typeof v === "function" ? v() : v)))) as {
		-readonly [i in keyof T]: Awaited<T[i] extends (...args: unknown[]) => infer R ? R : T[i]>;
	};
}

/**
 * Like {@link parallel} but uses Promise.allSettled.
 * @param funcs A rest param or array of async functions or promises to run
 * @returns The settled values of the promises.
 */
export async function parallelSettled<T extends Maybe<(() => Promise<unknown>) | Promise<unknown>>[]>(
	...funcs: T | [T]
) {
	return (await Promise.allSettled(normalizeArray(funcs).map((v) => (typeof v === "function" ? v() : v)))) as {
		-readonly [i in keyof T]: Awaited<T[i] extends (...args: unknown[]) => infer R ? R : T[i]>;
	};
}

/**
 * Runs promises in a race, the first one to resolve gets returned and others canceled.
 * Essentially a wrapper around {@link Promise.race}
 * @param funcs A rest param or array of async functions or promises to run
 * @returns The settled value of the first promise to resolve
 */
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

/**
 * Runs promises sequentially.
 * @param funcs A rest param or array of async functions or promises to run
 * @returns The settled value of the last promise
 */
export function sequential<T extends Maybe<() => Promise<unknown>>[]>(...funcs: T | [T]) {
	return normalizeArray(funcs).reduce(
		(acc, c) => (c ? acc.then(c) : acc),
		Promise.resolve<unknown>(),
	) as LastArrayElement<T>;
}
