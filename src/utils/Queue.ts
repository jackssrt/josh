/**
 * A queue. First in first out data structure.
 */
export class Queue<T> {
	private elements: T[];
	private head: number;
	private tail: number;

	constructor() {
		this.elements = [];
		this.head = 0;
		this.tail = -1;
	}

	public enqueue(item: T): void {
		this.elements[++this.tail] = item;
	}

	public dequeue(): T | undefined {
		if (this.isEmpty()) {
			return undefined;
		}

		const item = this.elements[this.head];
		// this is an array, not a tuple
		// this array is only indexed directly
		// eslint-disable-next-line @typescript-eslint/no-dynamic-delete, @typescript-eslint/no-array-delete
		delete this.elements[this.head++];
		return item;
	}

	public isEmpty(): boolean {
		return this.head > this.tail;
	}

	public clear(): void {
		this.elements = [];
		this.head = 0;
		this.tail = -1;
	}
}
