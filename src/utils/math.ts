/**
 * @link https://stackoverflow.com/questions/4154969/how-to-map-numbers-in-range-099-to-range-1-01-0/4155197#4155197
 */
export function scaleNumber(val: number, src: [number, number], dst: [number, number]): number {
	return ((val - src[0]) / (src[1] - src[0])) * (dst[1] - dst[0]) + dst[0];
}
