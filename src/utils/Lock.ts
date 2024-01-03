export default class Lock {
	private promise: Promise<void> | undefined = undefined;
	public async lock(lockingPromise: () => Promise<void>) {
		while (this.promise) await this.promise;
		this.promise = lockingPromise().finally(() => {
			this.promise = undefined;
		});
	}
}
