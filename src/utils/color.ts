import type { Option } from "ts-results-es";
import { None, Some } from "ts-results-es";

/**
 * @link https://stackoverflow.com/a/596243
 */
export function colorLuminance(r: number, g: number, b: number): number {
	return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * @link https://stackoverflow.com/a/39077686
 */
export function hexToRGB(hex: `#${string}`) {
	return hex
		.replace(
			/^#?([a-f\d])([a-f\d])([a-f\d])$/i,
			(_, r: string, g: string, b: string) => "#" + r + r + g + g + b + b,
		)
		.substring(1)
		.match(/.{2}/g)
		?.map((x) => parseInt(x, 16)) as [number, number, number];
}
export function parseHex(color: string): Option<string> {
	// Remove the leading '#' if present
	if (color.startsWith("#")) color = color.slice(1);

	// Check if the hexColor string is valid
	if (!/^[0-9A-Fa-f]{3}$|^[0-9A-Fa-f]{6}$/.test(color)) return None;

	// Expand the short-hand color notation (e.g., #abc to #aabbcc)
	if (color.length === 3) color = color.replace(/(.)/g, "$1$1");

	return Some(color);
}
