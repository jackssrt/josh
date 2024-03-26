import levenshtein from "js-levenshtein";
import type { TupleOf } from "../utils/types.js";
import { parallel } from "./promise.js";
import type { Uncallable } from "./types.js";

/**
 * Efficiently makes an array filled with the provided value.\
 * Also accepts a function as the value, in which case the function will be called for each element.
 * @param count The length of the created array
 * @param value The value or a function taking in the index and returning a value
 * @returns The created array
 */
export function fillArray<T, N extends number>(count: N, value: Uncallable<T> | ((i: number) => T)) {
	const array = Array.from({ length: count });
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

/**
 * Promisified version of {@link fillArray}.\
 * Only takes in an async function to generate the value.\
 * Run with {@link parallel}
 * @param count The length of the created array
 * @param creator The async function returning the value for each array element
 * @returns The created array
 */
export async function fillArrayAsync<T, N extends number>(count: N, creator: (i: number) => Promise<T>) {
	return (await parallel(fillArray(count, creator))) as number extends N ? T[] : TupleOf<T, N>;
}

/**
 * Searches through an array of strings and returns it sorted based on relevance to the search term.\
 * The algorithm is as follows:
 * 1. If the element starts with the search term, it should be first.
 * 2. If the element contains the search term, it should be after.
 * 3. Use the levenshtein difference between the element and the term.
 * @param source The array to search
 * @param rawTerm The term to search for
 * @returns The sorted array
 */
export function search<T extends string[]>(source: T, rawTerm: string): T[number][] {
	const term = rawTerm.trim().toLowerCase();
	// early return for empty search term
	if (term.length === 0) return source;
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
 * Gets random values from an array.
 * @link https://stackoverflow.com/a/12646864
 * @param arr The array to pick from
 * @param count The amount of values to pick
 * @returns The picked values
 */
export function getRandomValues<T extends unknown[]>(arr: T, count: number): T[number][] {
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr.slice(0, count);
}
