import { BULLET_EMOJI } from "../emojis.js";
import type { SchedulesAPI } from "../types/rotationNotifier.js";

export class Stage {
	public name: string;
	public vsStageId: number;

	public image: string;
	public id: string;
	constructor(data: SchedulesAPI.Stage) {
		this.name = data.name;
		this.vsStageId = data.vsStageId;
		this.image = data.image.url;
		this.id = data.id;
	}

	public short() {
		return ["Wahoo World", "Scorch Gorge", "Manta Maria"].includes(this.name)
			? this.name
			: this.name.split(" ")[0]!;
	}
}
export class CoopStage {
	public name:
		| "Spawning Grounds"
		| "Sockeye Station"
		| "Marooner's Bay"
		| "Gone Fission Hydroplant"
		| "Jammin' Salmon Junction"
		| "???";
	public image: string;
	public id: string;
	public emoji: string;

	constructor(data: SchedulesAPI.CoopRegularStage) {
		this.name = data.name === "" ? "???" : data.name;
		this.image = data.image.url;
		this.id = data.id;
		this.emoji = (
			{
				"Spawning Grounds": "<:spawningGrounds:1087077105638047764>",
				"Gone Fission Hydroplant": "<:goneFissionHydroplant:1087077100294516750>",
				"Marooner's Bay": "<:maroonersBay:1087077102559432894>",
				"Sockeye Station": "<:sockeyeStation:1087077104274911292>",
				"Jammin' Salmon Junction": "<:jamminSalmonJunction:1114180647129456693>",
				"???": BULLET_EMOJI,
			} as const satisfies Record<CoopStage["name"], string>
		)[this.name];
	}
}
