import type { ZodTuple, ZodTypeAny } from "zod";
import { z } from "zod";
import { fillArray } from "../utils/array.js";
import type { TupleOf } from "../utils/types.js";

export function repeatedZodTuple<T extends ZodTypeAny, N extends number>(
	value: AnyFunctionReturning<T>,
	length: N,
	args: Parameters<typeof value>,
): ZodTuple<TupleOf<T, N>>;
export function repeatedZodTuple<T extends ZodTypeAny, N extends number>(value: T, length: N): ZodTuple<TupleOf<T, N>>;
export function repeatedZodTuple<T extends ZodTypeAny | AnyFunctionReturning<ZodTypeAny>, N extends number>(
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyFunction = (...args: any[]) => any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyFunctionReturning<T> = (...args: any[]) => T;
