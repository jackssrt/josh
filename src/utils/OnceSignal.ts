/**
 * A signal that can only be fired once
 */
export default class OnceSignal {
	// fire is assigned to in the callback of new Promise below
	public fire!: () => void;
	// eslint-disable-next-line unicorn/consistent-function-scoping
	public readonly promise = new Promise<never>((resolve) => (this.fire = resolve as () => void));
	/**
	 * This exists to make OnceSignal awaitable
	 */
	// eslint-disable-next-line unicorn/no-thenable
	public then: Promise<never>["then"] = this.promise.then.bind(this.promise);
}
