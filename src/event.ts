import type { Awaitable, ClientEvents } from "discord.js";
import type { Client } from "./client.js";

export default interface Event<K extends keyof ClientEvents> {
	isOnetime?: boolean | undefined;
	event: K;
	ignoreCatchup?: boolean | undefined;
	on(param: { client: Client<true> }, ...params: ClientEvents[K]): Awaitable<void>;
}
