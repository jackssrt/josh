import levenshtein from "js-levenshtein";
import type { TupleOf } from "../types/utils.js";
import { parallel } from "./promise.js";
import type { Uncallable } from "./types.js";

export function fillArray<T, N extends number>(count: N, value: Uncallable<T> | ((i: number) => T)) {
	const array = new Array<T>(count);
	// checked early for performance, value doesn't change value between each item
	// prettier-ignore
	if (typeof value === "function")
		for (let i = 0; i < count; i++)
			array[i] = (value as (i: number) => T)(i);

	else
		for (let i = 0; i < count; i++)
			array[i] = value;
	return array as number extends N ? T[] : TupleOf<T, N>;
}

export async function fillArrayAsync<T, N extends number>(count: N, creator: (i: number) => Promise<T>) {
	return (await parallel(fillArray(count, creator))) as number extends N ? T[] : TupleOf<T, N>;
}

export function search<T extends string[]>(source: T, rawTerm: string): T[number][] {
	const term = rawTerm.trim().toLowerCase();
	// early return for empty search term
	if (!term.length) return source;
	return source
		.map((v) => v.trim().toLowerCase())
		.sort((a, b) => {
			const bStartsWith = b.startsWith(term);
			const aStartsWith = a.startsWith(term);
			if (aStartsWith && bStartsWith) return 0;
			else if (bStartsWith) return 1;
			else if (aStartsWith) return -1;
			const bContains = b.includes(term);
			const aContains = a.includes(term);
			if (bContains && aContains) return 0;
			else if (bContains) return 1;
			else if (aContains) return -1;

			return levenshtein(a, term) - levenshtein(b, term);
		});
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
