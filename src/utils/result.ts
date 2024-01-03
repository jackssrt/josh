import type { Result } from "ts-results-es";
import { Err, Ok } from "ts-results-es";

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
