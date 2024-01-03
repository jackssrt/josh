export default class SyncSignal {
	public readonly promise = new Promise<never>((resolve) => (this.fire = resolve as () => void));
	// fire is assigned to in the callback of new Promise above
	public fire: () => void = null!;
	/**
	 * This exists to make SyncSignal awaitable
	 */
	public then: Promise<never>["then"] = this.promise.then.bind(this.promise);
}
