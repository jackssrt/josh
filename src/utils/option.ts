import type { Option } from "ts-results-es";

export function flattenOptionArray<T>(array: Option<T>[]): T[] {
	return array.reduce<T[]>((acc, v) => {
		if (v.isSome()) acc.push(v.value);
		return acc;
	}, []);
}
