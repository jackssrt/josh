import { expect, test } from "vitest";
import { RankedOpenNode, TimeRange, TurfWarNode } from "../../src/rotations/nodes.js";
import type { SchedulesAPI } from "../../src/types/rotationNotifier.js";
import { LARGEST_DATE, SMALLEST_DATE } from "../../src/utils.js";

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
class TimeRangeImpl extends TimeRange {}
const timeRangePast = new TimeRangeImpl(SMALLEST_DATE, SMALLEST_DATE);
const timeRangeActive = new TimeRangeImpl(SMALLEST_DATE, LARGEST_DATE);
const timeRangeFuture = new TimeRangeImpl(LARGEST_DATE, LARGEST_DATE);

test("TimeRange", () => {
	expect(timeRangePast.started).toBe(true);
	expect(timeRangePast.ended).toBe(true);
	expect(timeRangePast.active).toBe(false);
	expect(timeRangePast.future).toBe(false);
	expect(timeRangeActive.started).toBe(true);
	expect(timeRangeActive.ended).toBe(false);
	expect(timeRangeActive.active).toBe(true);
	expect(timeRangeActive.future).toBe(false);
	expect(timeRangeFuture.started).toBe(false);
	expect(timeRangeFuture.ended).toBe(false);
	expect(timeRangeFuture.active).toBe(false);
	expect(timeRangeFuture.future).toBe(true);
});
