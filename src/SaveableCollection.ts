import { Collection } from "discord.js";
import { writeFileSync } from "node:fs";
import { loadJson } from "./utils.js";

export class SaveableCollection<V> extends Collection<string, V> {
	constructor(public path: string, iterable?: Iterable<readonly [string, V]> | null) {
		super(iterable);
	}
	public static async new<V, T>(path: string, transformer: (value: T) => V): Promise<SaveableCollection<V>> {
		const f = await loadJson<Record<string, T>>(path, (_, v: unknown) =>
			typeof v === "string" && v.startsWith("BigInt") ? BigInt(v.substring("BigInt".length)) : v,
		);
		return new this(
			path,
			Object.entries(f).map((v) => [v[0], transformer(v[1])]),
		);
	}
	public save() {
		writeFileSync(
			this.path,
			JSON.stringify(
				Object.fromEntries(this.entries()),
				(_, v: unknown) => (typeof v === "bigint" ? `BigInt${v}` : v),
				"    ",
			),
		);
	}
}
