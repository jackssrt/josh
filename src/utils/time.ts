import { TimestampStyles, time } from "discord.js";

export const SMALLEST_DATE = new Date(-8640000000000000);
export const LARGEST_DATE = new Date(8640000000000000);

/**
 * Pauses the program for the specified amount of time.
 * @param delay how many **seconds** (not milliseconds) it should wait
 */
export function wait(delay: number): Promise<void> {
	return new Promise((resolve) => setTimeout(() => resolve(), delay * 1000));
}

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

export function futureTimestamp(inXSeconds: number, from = new Date()) {
	return time(new Date(from.getTime() + inXSeconds * 1000), TimestampStyles.RelativeTime);
}
