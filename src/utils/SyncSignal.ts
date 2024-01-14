/**
 * A signal to sync promises
 */
export default class SyncSignal {
	// fire is assigned to in the callback of new Promise below
	public fire!: () => void;
	public readonly promise = new Promise<never>((resolve) => (this.fire = resolve as () => void));
	/**
	 * This exists to make SyncSignal awaitable
	 */
	public then: Promise<never>["then"] = this.promise.then.bind(this.promise);
}