import { EventEmitter } from "events";
import { awaitEvent } from "./utils.js";

export default class SyncSignal {
	private fired = false;
	private ee: EventEmitter = new EventEmitter();
	public fire() {
		this.fired = true;
		this.ee.emit("fire");
	}
	public async await() {
		if (this.fired) return;
		await awaitEvent(this.ee, "fire");
	}
}