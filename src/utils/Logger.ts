/* eslint-disable no-console */
import styles from "ansi-styles";
import { appendFile } from "node:fs/promises";
import { inspect } from "node:util";
import { isError } from "../errorhandler.js";
import { COLORS_REGEX } from "./regex.js";
/**
 * A logger.
 * Logs to both the terminal and a file.
 */
export class Logger {
	private static readonly LOG_FILE = `./logs/${new Date().toISOString().replaceAll(/[.:]/g, " ")}.log` as const;

	private log(color: string | undefined, tag: string | undefined, first: unknown, rest: unknown[]) {
		rest.unshift(first);
		process.nextTick(async () => {
			const output = `${styles.gray.open}[${new Date().toLocaleTimeString()}]${styles.gray.close} ${color ?? ""}${
				tag ?? ""
			}${tag ? " " : ""}${rest
				.map((v) => {
					try {
						if (isError(v)) return v;

						if (typeof v !== "string") return inspect(v, { compact: false, colors: true });
						return v;
					} catch {
						return v;
					}
				})
				.join(" ")}${styles.reset.open}${styles.reset.close}`;
			console.log(output);
			await appendFile(Logger.LOG_FILE, `${output.replace(COLORS_REGEX, "")}\n`, { encoding: "utf8" });
		});
	}

	public debug(first: unknown, ...rest: unknown[]) {
		this.log(`${styles.gray.open}${styles.dim.open}`, "[D]", first, rest);
	}

	public info(first: unknown, ...rest: unknown[]) {
		this.log(undefined, undefined, first, rest);
	}

	public warn(first: unknown, ...rest: unknown[]) {
		this.log(styles.yellowBright.open, "[WARN]", first, rest);
	}

	public error(first: unknown, ...rest: unknown[]) {
		this.log(styles.redBright.open, "[ERROR]", first, rest);
	}
}

const logger = new Logger();

process.on("warning", (...params) => logger.warn(...params));

export default logger;
