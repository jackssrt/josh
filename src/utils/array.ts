import levenshtein from "js-levenshtein";
import type { TupleOf } from "../types/utils.js";
import { parallel } from "./promise";
import type { Uncallable } from "./types";

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
