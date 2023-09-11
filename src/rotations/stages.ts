import { match } from "ts-pattern";
import {
	BULLET_EMOJI,
	GONE_FISSION_HYDROPLANT_EMOJI,
	JAMMIN_SALMON_JUNCTION_EMOJI,
	MAROONERS_BAY_EMOJI,
	SALMONID_SMOKEYARD_EMOJI,
	SOCKEYE_STATION_EMOJI,
	SPAWNING_GROUNDS_EMOJI,
} from "../emojis.js";
import type * as SchedulesAPI from "../types/schedulesApi.js";

export abstract class BaseStage {
	constructor(
		public name: string,
		public image: string,
		public id: string,
	) {}
	public short() {
		return ["Wahoo World", "Scorch Gorge", "Manta Maria"].includes(this.name)
			? this.name
			: this.name.split(" ")[0]!;
	}
}

export class Stage extends BaseStage {
	public vsStageId: number;
	constructor(data: SchedulesAPI.LowImageQualityStage, vsStages: SchedulesAPI.HighImageQualityStage[]) {
		super(
			data.name,
			vsStages[data.vsStageId - 1]?.originalImage.url ??
				vsStages.find((v) => v.vsStageId === data.vsStageId)?.originalImage.url ??
				data.image.url,
			data.id,
		);
		this.vsStageId = data.vsStageId;
	}
}

export class BaseCoopStage extends BaseStage {
	public emoji = BULLET_EMOJI;
}
export class CoopStage extends BaseCoopStage {
	public declare name:
		| "Spawning Grounds"
		| "Sockeye Station"
		| "Marooner's Bay"
		| "Gone Fission Hydroplant"
		| "Jammin' Salmon Junction"
		| "Salmonid Smokeyard"
		| "???";

	constructor(data: SchedulesAPI.CoopStage) {
		super(data.name === "" ? "???" : data.name, data.image.url, data.id);
		this.emoji = match(this.name)
			.with("Spawning Grounds", () => SPAWNING_GROUNDS_EMOJI)
			.with("Gone Fission Hydroplant", () => GONE_FISSION_HYDROPLANT_EMOJI)
			.with("Marooner's Bay", () => MAROONERS_BAY_EMOJI)
			.with("Sockeye Station", () => SOCKEYE_STATION_EMOJI)
			.with("Jammin' Salmon Junction", () => JAMMIN_SALMON_JUNCTION_EMOJI)
			.with("Salmonid Smokeyard", () => SALMONID_SMOKEYARD_EMOJI)
			.otherwise(() => BULLET_EMOJI);
	}
}
export class BigRunStage extends BaseCoopStage {
	constructor(data: SchedulesAPI.CoopStage<true>) {
		super(data.name, data.image.url, data.id);
	}
}
