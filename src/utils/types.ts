import type { AnyFunction } from "../schemas/utils.js";

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
 * Excludes functions from T.
 */
export type Uncallable<T> = T extends AnyFunction ? never : T;

/**
 * Any defined type.
 */
export type defined = NonNullable<unknown>;

/**
 * Exclude from T those types that are assignable to U.\
 * U can only have types that are assignable to T.
 */
export type StrictExclude<T, U extends T> = Exclude<T, U>;

/**
 * Makes a tuple with T repeated N times.
 */
export type TupleOf<T, N extends number, A extends unknown[] = []> = A["length"] extends N
	? A
	: TupleOf<T, N, [T, ...A]>;

/**
 * Returns a union of all the keys of T whose values extend from U
 * @link https://roblox-ts.com/docs/api/utility-types#extractkeyst-u
 */
export type ExtractKeys<T, U> = { [K in keyof T]: T[K] extends U ? K : never }[keyof T];

/**
 * Returns a new object type of all the keys of T whose values extend from U
 * @link https://roblox-ts.com/docs/api/utility-types#extractmemberst-u
 */
export type ExtractMembers<T, U> = Pick<T, ExtractKeys<T, U>>;
