export default abstract class TimePeriod {
	public startTime: Date;
	public endTime: Date;
	public get started() {
		return this.startTime.getTime() < Date.now();
	}
	public get ended() {
		return this.endTime.getTime() < Date.now();
	}
	public get active() {
		return this.started && !this.ended;
	}
	public get future() {
		return !this.started && !this.ended;
	}
	constructor(startTime: string | Date, endTime: string | Date) {
		this.startTime = startTime instanceof Date ? startTime : new Date(Date.parse(startTime));
		this.endTime = endTime instanceof Date ? endTime : new Date(Date.parse(endTime));
	}
}
