import type { Awaitable, ClientEvents } from "discord.js";
import type Client from "./client.js";

export interface Event<K extends keyof ClientEvents> {
	isOnetime?: boolean | undefined;
	event: K;
	ignoreCatchup?: boolean | undefined;
	on: (param: { client: Client<true> }, ...params: ClientEvents[K]) => Awaitable<unknown>;
}
/**
 * An identity function to make typescript supply the type argument automatically.
 * @param event Event
 * @returns Event
 */
export default function createEvent<K extends keyof ClientEvents>(event: Event<K>): Event<K> {
	return event;
}
