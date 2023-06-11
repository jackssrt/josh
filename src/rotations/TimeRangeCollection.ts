import type TimeRange from "./TimeRange.js";

export default class TimeRangeCollection<T extends TimeRange | undefined> {
	constructor(public ranges: T[]) {}
	public get active() {
		return this.ranges.find((v) => v?.active);
	}
	public future(n?: number | undefined) {
		const future = this.ranges.filter((v) => v?.future);
		return future.slice(0, n ?? future.length);
	}
}
export class PoppingTimeRangeCollection<T extends TimeRange | undefined> extends TimeRangeCollection<T> {
	constructor(ranges: T[]) {
		super(ranges);
		if (this.ranges.length === 0 || this.ranges[0] === undefined) return;
		while (this.ranges[0].ended) {
			// first node has ended, remove it from the array
			this.ranges.shift();
			if (this.ranges.length === 0) return;
		}
	}
}
