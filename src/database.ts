import axios from "axios";
import consola from "consola";
import Keyv from "keyv";
import { USER_AGENT } from "./client.js";
import type { SalmonRunAPIResponse } from "./types/rotationNotifier.js";

interface DatabaseData {
	createdSplatfestEvent: string;
	lastSentMapRotation: number;
	lastSentSalmonRunRotation: number;
	monthlySalmonRunGearMonth: number;
	monthlySalmonRunGear: { name: string; image: string };
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

	async setLastSendMapRotation(startedTime: Date) {
		await this.keyv.set("lastSentMapRotation", startedTime.getTime());
	}
	async setLastSendSalmonRunRotation(startedTime: Date) {
		await this.keyv.set("lastSentSalmonRunRotation", startedTime.getTime());
	}
	async activeMonthlySalmonRunGear(): Promise<DatabaseData["monthlySalmonRunGear"]> {
		const lastMonth = (await this.keyv.get("monthlySalmonRunGearMonth")) as
			| DatabaseData["monthlySalmonRunGearMonth"]
			| undefined;
		if (lastMonth === new Date().getMonth())
			return (await this.keyv.get("monthlySalmonRunGear")) as DatabaseData["monthlySalmonRunGear"];
		const { data: apiData } = await axios.get<SalmonRunAPIResponse>("https://splatoon3.ink/data/coop.json", {
			headers: { "User-Agent": USER_AGENT },
		});
		const {
			name,
			image: { url: image },
		} = apiData.data.coopResult.monthlyGear;
		const data = { name, image };
		await this.keyv.set("monthlySalmonRunGear", data);
		await this.keyv.set("monthlySalmonRunGearMonth", new Date().getMonth());
		return data;
	}
	async shouldSendSalmonRunRotation() {
		const FOURTY_HOURS = 40 * 60 * 60 * 1000;
		const TEN_MINUTES = 10 * 60 * 1000;
		return (
			(((await this.keyv.get("lastSentSalmonRunRotation")) as DatabaseData["lastSentMapRotation"] | undefined) ??
				new Date().getTime()) +
				FOURTY_HOURS -
				TEN_MINUTES -
				new Date().getTime() >
			0
		);
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
