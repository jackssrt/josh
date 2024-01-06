import type { Option } from "ts-results-es";

/**
 * Turns an array of options into an array of the values where they are Some.
 * @param array The array of options
 * @returns The output array of unwrapped values
 */
export function flattenOptionArray<T>(array: Option<T>[]): T[] {
	return array.reduce<T[]>((acc, v) => {
		if (v.isSome()) acc.push(v.value);
		return acc;
	}, []);
}
