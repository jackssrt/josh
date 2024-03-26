import type EventEmitter from "node:events";
import { wait } from "./time.js";

/**
 * Get the parameters of events in an eventEmitter.
 */

export type EventParams<T extends EventEmitter> = Parameters<Parameters<T["on"]>[1]>;

/**
 * Get the names of events in an eventEmitter.
 */
export type EventNames<T extends EventEmitter> = Parameters<T["on"]>[0];

/**
 * Await for an eventemitter to emit specific events.
 * Makes eventemitters able to be awaited.
 * @param ee the eventemitter
 * @param timeoutSeconds longest time to wait for events in seconds
 * @param event the event(s) to wait for
 * @returns a Promise that resolves when the events are emitted or times out, with the arguments of the event or an empty array
 */
export async function awaitEvent<T extends EventEmitter, E extends string | symbol = EventNames<T>>(
	ee: T,
	event: E[] | E,
	timeoutSeconds?: number | undefined,
): Promise<EventParams<T> | []> {
	const events = Array.isArray(event) ? event : [event];
	return new Promise((resolve) => {
		function listener(...args: unknown[]) {
			for (const e of events) ee.removeListener(e, listener);
			resolve(args as EventParams<T>);
		}
		for (const e of events) ee.on(e, listener);

		function onTimeout() {
			for (const e of events) ee.removeListener(e, listener);
			resolve([]);
		}
		if (timeoutSeconds) wait(timeoutSeconds).then(onTimeout).catch(onTimeout);
	});
}
