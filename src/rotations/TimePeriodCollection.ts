import type TimePeriod from "./TimePeriod.js";

export default class TimePeriodCollection<T extends TimePeriod | undefined> {
	constructor(public periods: T[]) {}
	public get active() {
		return this.periods.find((v) => v?.active);
	}
	public future(n?: number | undefined) {
		const future = this.periods.filter((v) => v?.future);
		return future.slice(0, n ?? future.length);
	}
}
export class PoppingTimePeriodCollection<T extends TimePeriod | undefined> extends TimePeriodCollection<T> {
	constructor(periods: T[]) {
		super(periods);
		if (this.periods.length === 0 || this.periods[0] === undefined) return;
		while (this.periods[0].ended) {
			// first node has ended, remove it from the array
			this.periods.shift();
			if (this.periods.length === 0 || this.periods[0] === undefined) return;
		}
	}
}
