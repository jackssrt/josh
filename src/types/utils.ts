import type { ZodTuple, ZodTypeAny } from "zod";
import { z } from "zod";
import { fillArray } from "../utils/array.js";

export type TupleOf<T, N extends number, A extends unknown[] = []> = A["length"] extends N
	? A
	: TupleOf<T, N, [T, ...A]>;
export function repeatedTuple<T extends ZodTypeAny, N extends number>(
	value: AnyFunctionReturning<T>,
	length: N,
	args: Parameters<typeof value>,
): ZodTuple<TupleOf<T, N>>;
export function repeatedTuple<T extends ZodTypeAny, N extends number>(value: T, length: N): ZodTuple<TupleOf<T, N>>;
export function repeatedTuple<T extends ZodTypeAny | AnyFunctionReturning<ZodTypeAny>, N extends number>(
	value: T,
	length: N,
	args: T extends AnyFunction ? Parameters<typeof value> | undefined : undefined = undefined as T extends AnyFunction
		? Parameters<typeof value> | undefined
		: undefined,
): ZodTuple<TupleOf<T extends AnyFunction ? ReturnType<typeof value> : T, N>> {
	return z.tuple(
		fillArray(length, typeof value === "function" ? value(...(args ?? [])) : value) as TupleOf<
			T extends AnyFunction ? ReturnType<typeof value> : T,
			N
		>,
	);
}
export const nodes = <T extends ZodTypeAny>(value: T) =>
	z.object({
		nodes: z.array(value),
	});
export type Call<F extends AnyFunction, P extends Parameters<F>> = F extends (...params: P) => infer R ? R : never;

export type StrictOmit<T, K extends keyof T> = Omit<T, K>;

export type StrictExclude<T, K extends T> = Exclude<T, K>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyFunction = (...args: any[]) => any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyFunctionReturning<T> = (...args: any[]) => T;

/**
 * Any defined type
 */
export type defined = NonNullable<unknown>;
