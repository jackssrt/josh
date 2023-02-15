import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { loadJson } from "./utils.js";

export class SaveableValue<T> {
	private constructor(private filename: string, private privateValue: T) {}
	public static async new<T>(filename: string, defaultValue: T): Promise<SaveableValue<T>> {
		const data = existsSync(filename) ? await loadJson<T>(filename) : defaultValue;

		return new this(filename, data);
	}

	get value(): T {
		return this.privateValue;
	}
	async setValue(value: T): Promise<T> {
		this.privateValue = value;
		await writeFile(
			this.filename,
			JSON.stringify(this.privateValue, (_, v) => v as unknown),
		);
		return this.privateValue;
	}
}
