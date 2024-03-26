import { TimestampStyles, time } from "discord.js";

/**
 * The earliest possible date
 */
export const SMALLEST_DATE = new Date(-8_640_000_000_000_000);
/**
 * The latest possible date
 */
export const LARGEST_DATE = new Date(8_640_000_000_000_000);

/**
 * Pauses the program for the specified amount of time.
 * @param delay how many **seconds** (not milliseconds) it should wait
 */
export function wait(delay: number): Promise<void> {
	return new Promise((resolve) => setTimeout(() => resolve(), delay * 1000));
}

/**
 * Formats a specified number of seconds into a human-readable format
 * @example "10h 20m 30s ago"
 * @param totalSeconds The number of seconds to format
 * @returns The string
 */
export function formatTime(totalSeconds: number): string {
	const parts: string[] = [];
	const hours = Math.floor(Math.abs(totalSeconds) / 60 / 60);
	const minutes = Math.floor(Math.abs(totalSeconds) / 60);
	const seconds = Math.floor(Math.abs(totalSeconds));
	if (hours > 0) parts.push(`${hours}h`);
	if (minutes % 60 > 0) parts.push(`${minutes % 60}m`);
	if (seconds % 60 > 0 || Math.abs(totalSeconds) < 60) parts.push(`${seconds % 60}s`);
	if (totalSeconds < 0) parts.push("ago");

	return parts.join(" ");
}

/**
 * Returns a timestamp for a future date/time relative to the provided `from` date.
 * The future timestamp will be `inXSeconds` seconds in the future from `from`.
 *
 * @param inXSeconds The number of seconds in the future for the timestamp
 * @param from The base date to calculate the future timestamp from. Defaults to current date/time
 * @returns A relative timestamp string for the future date/tim
 */
export function futureTimestamp(inXSeconds: number, from = new Date()) {
	return time(new Date(from.getTime() + inXSeconds * 1000), TimestampStyles.RelativeTime);
}
