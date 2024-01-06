import type { AnyFunction } from "../types/utils.js";

export type Maybe<T> = T | false | undefined;

export type If<C extends boolean, V, NV = V | undefined> = C extends true ? V : NV;

/**
 * Inverse of {@link If}.
 */
export type IfNot<C extends boolean, V, NV = V | undefined> = C extends true ? NV : V;

/**
 * An array with at least one element.
 */
export type OneOrMore<T> = [T, ...T[]];

/**
 * Excludes functions from T
 */
export type Uncallable<T> = T extends AnyFunction ? never : T;

/**
 * Custom type guard for checking if a value is an error.
 * @param e the thing to test
 * @returns e is Error
 */
export function isError(e: unknown): e is Error {
	return e instanceof Error;
}
