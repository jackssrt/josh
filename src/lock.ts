import { randomUUID } from "crypto";
import EventEmitter from "events";
import logger from "./logger.js";
import { awaitEvent } from "./utils.js";
type Key = string;

export default class Lock {
	private lockKey: string | undefined = undefined;
	private readonly ee = new EventEmitter();
	public unlock(key: Key) {
		if (key !== this.lockKey) logger.warn(`Something tried to unlock a lock with "${key}", an incorrect key!`);
		this.lockKey = undefined;
		this.ee.emit("unlocked");
	}
	public async lock(): Promise<Key> {
		if (this.lockKey !== undefined) await awaitEvent(this.ee, "unlocked");
		this.lockKey = randomUUID();
		return this.lockKey;
	}
}
