/**
 * Scales a number from a range to another
 * @link https://stackoverflow.com/questions/4154969/how-to-map-numbers-in-range-099-to-range-1-01-0/4155197#4155197
 * @param val The number to scale
 * @param src The inclusive source range
 * @param dst The inclusive output range
 * @returns The scaled number
 */
export function scaleNumber(val: number, src: [number, number], dst: [number, number]): number {
	return ((val - src[0]) / (src[1] - src[0])) * (dst[1] - dst[0]) + dst[0];
}
