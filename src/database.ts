import consola from "consola";
import Keyv from "keyv";

interface DatabaseData {
	createdSplatfestEvent: string;
	lastSentMapRotation: number;
}

export class Database {
	private keyv = new Keyv<DatabaseData[keyof DatabaseData]>("sqlite://database.sqlite");
	constructor() {
		this.keyv.on("error", (err) => consola.error("Keyv connection error:", err));
	}

	async setSplatfestEventCreated(id: string) {
		await this.keyv.set("createdSplatfestEvent", id);
	}
	async isSplatfestEventCreated(id: string) {
		return ((await this.keyv.get("createdSplatfestEvent")) as DatabaseData["createdSplatfestEvent"]) === id;
	}

	async setLastSendMapRotation(date: Date) {
		await this.keyv.set("lastSentMapRotation", date.getTime());
	}
	async timeTillNextMapRotationSend() {
		const TWO_HOURS = 2 * 60 * 60 * 1000;
		return (
			((await this.keyv.get("lastSentMapRotation")) as DatabaseData["lastSentMapRotation"]) +
			TWO_HOURS -
			new Date().getTime()
		);
	}
}

export default new Database();
