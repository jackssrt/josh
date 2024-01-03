import { EventEmitter } from "events";
import { awaitEvent } from "./eventEmitter.js";

export default class SyncSignal {
	private fired = false;
	private readonly ee: EventEmitter = new EventEmitter();

	public fire() {
		this.fired = true;
		this.ee.emit("fire");
	}

	public async await() {
		if (this.fired) return;
		await awaitEvent(this.ee, "fire");
	}
}
