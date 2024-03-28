import { default as pathLib } from "node:path";
import { IS_BUILT } from "../env.js";

const cwd = process.cwd();
type TaggedTemplate = (strings: TemplateStringsArray, ...values: unknown[]) => string;

/**
 * Returns an absolute path relative to the root.
 * @param path The path
 * @returns The absolute path
 */
const path = pathLib.resolve.bind(pathLib, cwd);
function middleware(...paths: string[]): TaggedTemplate {
	return (strings, ...values) =>
		path(
			...paths,
			strings.reduce((acc, cur, i) => {
				// eslint-disable-next-line @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-base-to-string, @typescript-eslint/no-unnecessary-condition
				return `${acc ?? ""}${values[i - 1] ?? ""}${cur ?? ""}`;
			}, ""),
		);
}
const codeRootDir = IS_BUILT ? "build" : "src";

// Directories //
export const root = middleware();
export const codeRoot = middleware(codeRootDir);
export const commands = middleware(codeRootDir, "commands");
export const assets = middleware("assets");

// Files //
export const database = root`database.json`;
export const startupSound = assets`startup.wav`;

// Functions //
export function fileURI<T extends string>(path: T) {
	return `file:///${path}` as const;
}
