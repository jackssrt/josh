import { describe, expect, test } from "vitest";
import { Stage } from "../../src/rotations/stages.js";

describe("Stage", () => {
	test("short", () => {
		expect(new Stage({ id: "", image: { url: "" }, name: "Inkblot Art Academy", vsStageId: 0 }).short()).toBe(
			"Inkblot",
		);
		for (const x of ["Wahoo World", "Scorch Gorge", "Manta Maria"]) {
			expect(new Stage({ id: "", image: { url: "" }, name: x, vsStageId: 0 }).short()).toBe(x);
		}
	});
});
