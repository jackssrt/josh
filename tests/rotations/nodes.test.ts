import { expect, test } from "vitest";
import { RankedOpenNode, TurfWarNode } from "../../src/rotations/nodes.js";
import type { SchedulesAPI } from "../../src/types/rotationNotifier.js";

const turfWar = new TurfWarNode(
	{
		endTime: "2023-05-17T14:00:00Z",
		regularMatchSetting: null! as SchedulesAPI.TurfWarSetting,
		startTime: "2023-05-17T16:00:00Z",
	},
	{
		__typename: "RegularMatchSetting",
		festMatchSettings: null,
		vsRule: { id: "VnNSdWxlLTA=", name: "Turf War", rule: "TURF_WAR" },
		vsStages: [
			{ id: "", image: { url: "" }, name: "Test Stage", vsStageId: 1 },
			{ id: "", image: { url: "" }, name: "Wahoo World", vsStageId: 1 },
		],
	},
);
const ranked = new RankedOpenNode(
	{
		endTime: "2023-05-17T14:00:00Z",
		bankaraMatchSettings: null! as [SchedulesAPI.RankedSetting<"CHALLENGE">, SchedulesAPI.RankedSetting<"OPEN">],
		startTime: "2023-05-17T16:00:00Z",
	},
	{
		__typename: "BankaraMatchSetting",
		festMatchSettings: null,
		vsRule: { name: "Tower Control", rule: "LOFT", id: "VnNSdWxlLTI=" },
		mode: "OPEN",
		vsStages: [
			{ id: "", image: { url: "" }, name: "Test Stage", vsStageId: 1 },
			{ id: "", image: { url: "" }, name: "Wahoo World", vsStageId: 1 },
		],
	},
);
test("DisplayableMatchNode", () => {
	expect(turfWar.short()).includes("Test");
	expect(turfWar.short()).includes("Wahoo World");
});

test("TurfWarNode", () => {
	expect(turfWar.short()).not.includes(turfWar.rule.emoji);
});
test("RankedOpenNode", () => {
	expect(ranked.short()).includes(ranked.rule.emoji);
});
