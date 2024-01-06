/**
 * A lock which makes only one thread at a time be able to execute a promise
 */
export default class Lock {
	private promise: Promise<void> | undefined = undefined;
	/**
	 * Lock the Lock.\
	 * When the lockingPromise resolves the Lock is automatically unlocked.
	 * @param lockingPromise An async function in which the lock will be locked
	 */
	public async lock(lockingPromise: () => Promise<void>) {
		while (this.promise) await this.promise;
		this.promise = lockingPromise().finally(() => {
			this.promise = undefined;
		});
	}
}
