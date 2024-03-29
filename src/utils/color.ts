import type { Option } from "ts-results-es";
import { None, Some } from "ts-results-es";

/**
 * @link https://stackoverflow.com/a/596243
 */
export function colorLuminance(r: number, g: number, b: number): number {
	return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Converts a hex string to RGB
 * @link https://stackoverflow.com/a/39077686
 */
export function hexToRGB(hex: `#${string}`) {
	return hex
		.replace(
			/^#?([\da-f])([\da-f])([\da-f])$/i,
			(_, r: string, g: string, b: string) => "#" + r + r + g + g + b + b,
		)
		.slice(1)
		.match(/.{2}/g)
		?.map((x) => Number.parseInt(x, 16)) as [number, number, number];
}
/**
 * Parses a string for a hex color
 * @param color A string possibly containing a hex color
 * @returns Option of the hex color in lowercase or uppercase, for example: `FF00aa`
 */
export function parseHex(color: string): Option<`${string}${string}${string}${string}${string}${string}`> {
	// Remove the leading '#' if present
	if (color.startsWith("#")) color = color.slice(1);

	// Check if the hexColor string is valid
	if (!/^[\dA-Fa-f]{3}$|^[\dA-Fa-f]{6}$/.test(color)) return None;

	// Expand the short-hand color notation (e.g., #abc to #aabbcc)
	if (color.length === 3) color = color.replaceAll(/(.)/g, "$1$1");

	return Some(color);
}
