import {
	BULLET_EMOJI,
	GONE_FISSION_HYDROPLANT_EMOJI,
	JAMMIN_SALMON_JUNCTION_EMOJI,
	MAROONERS_BAY_EMOJI,
	SOCKEYE_STATION_EMOJI,
	SPAWNING_GROUNDS_EMOJI,
} from "../emojis.js";
import type * as SchedulesAPI from "../types/schedulesApi.js";

export class Stage {
	public name: string;
	public vsStageId: number;

	public image: string;
	public id: string;
	constructor(data: SchedulesAPI.Stage, vsStages: SchedulesAPI.Stage<"high">[]) {
		this.name = data.name;
		this.vsStageId = data.vsStageId;
		this.image =
			vsStages[data.vsStageId - 1]?.originalImage.url ??
			vsStages.find((v) => v.vsStageId === data.vsStageId)?.originalImage.url ??
			data.image.url;
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
				"Spawning Grounds": SPAWNING_GROUNDS_EMOJI,
				"Gone Fission Hydroplant": GONE_FISSION_HYDROPLANT_EMOJI,
				"Marooner's Bay": MAROONERS_BAY_EMOJI,
				"Sockeye Station": SOCKEYE_STATION_EMOJI,
				"Jammin' Salmon Junction": JAMMIN_SALMON_JUNCTION_EMOJI,
				"???": BULLET_EMOJI,
			} as const satisfies Record<CoopStage["name"], string>
		)[this.name];
	}
}
