/**
 * A signal
 */
export default class Signal {
	// resolve is assigned to in the callback of new Promise below
	private resolve!: () => void;
	// eslint-disable-next-line unicorn/consistent-function-scoping
	public promise = new Promise<never>((resolve) => (this.resolve = resolve as () => void));
	public fire() {
		this.resolve();
		this.promise = new Promise<never>((resolve) => (this.resolve = resolve as () => void));
		// eslint-disable-next-line unicorn/no-thenable
		this.then = this.promise.then.bind(this.promise);
	}
	/**
	 * This exists to make Signal awaitable
	 */
	// eslint-disable-next-line unicorn/no-thenable
	public then: Promise<never>["then"] = this.promise.then.bind(this.promise);
}
