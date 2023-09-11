import type { Primitive, ZodLiteral, ZodTuple, ZodTypeAny } from "zod";
import { z } from "zod";

export const literalUnion = <T extends Primitive>(first: T, second: T, ...rest: T[]) =>
	z.union([first, second, ...rest].map((v) => z.literal(v)) as [ZodLiteral<T>, ZodLiteral<T>, ...ZodLiteral<T>[]]);
export type TupleOf<T, N extends number, A extends unknown[] = []> = A["length"] extends N
	? A
	: TupleOf<T, N, [T, ...A]>;

export const repeatedTuple = <T extends ZodTypeAny, N extends number>(value: T, length: N): ZodTuple<TupleOf<T, N>> =>
	z.tuple(new Array(length).fill(value) as TupleOf<T, N>);
export const nodes = <T extends ZodTypeAny>(value: T) =>
	z.object({
		nodes: z.array(value),
	});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Call<F extends (...params: any[]) => any, P extends Parameters<F>> = F extends (...params: P) => infer R
	? R
	: never;
export type StrictOmit<T, K extends keyof T> = Omit<T, K>;

export type StrictExclude<T, K extends T> = Exclude<T, K>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyFunction = (...args: any[]) => any;
