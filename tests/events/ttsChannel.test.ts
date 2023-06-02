import { describe, expect, it } from "vitest";
import { clean } from "./../../src/events/ttsChannel.js";

describe("clean()", () => {
	it("should filter out emoji syntax", () => {
		expect(clean("<:jamminSalmonJunction:1114180647129456693>")).toBe("jamminSalmonJunction");
		expect(clean("<a:squidbag:751553798367084584>")).toBe("squidbag");
		expect(clean("<id:customize>")).toBe("");
	});
	it("should filter out underscores", () => {
		expect(clean("test_message")).toBe("test message");
	});
	it("should filter out links", () => {
		expect(clean("Blah https://example.com Blah")).toBe("Blah  Blah");
		expect(clean("https://example.com")).toBe("");
		expect(clean("https://subdomain.example.com")).toBe("");
		expect(clean("http://example.com")).toBe("");
		expect(clean("https://password:username@example.com/")).toBe("");
	});
});
