/**
 * Truncate a string, if it is over maxLength. An ellipsis will be added if the text is truncated.
 * @param text The text to truncate
 * @param maxLength The length to truncate at
 * @returns The truncated text
 */
export function truncate(text: string, maxLength: number) {
	maxLength = Math.max(maxLength, 3);
	return text.length > maxLength ? text.slice(0, maxLength - 3) + "..." : text;
}

/**
 * Splits a string into specified length chunks.
 * @param text The string to split
 * @param chunkSize The size of the chunks
 */
export function chunkify(text: string, chunkSize: number): string[] {
	const size = Math.ceil(text.length / chunkSize);
	const result: string[] = Array.from({ length: size });
	for (let i = 0; i < size; i++) result[i] = text.slice(i * chunkSize, (i + 1) * chunkSize);
	return result;
}

/**
 * Possibly pluralizes a noun.
 * @param noun The noun to pluralize
 * @param amount The amount of the noun
 * @returns The pluralized noun
 */
export function pluralize(noun: string, amount: number): string {
	return `${noun}${amount === 1 ? "" : "s"}`;
}

/**
 * Escapes xml code, to prevent xml injection.
 * @link https://stackoverflow.com/a/27979933
 */
export function escapeXml(unsafe: string) {
	return unsafe.replaceAll(/["&'<>]/g, function (c) {
		switch (c) {
			case "<":
				return "&lt;";
			case ">":
				return "&gt;";
			case "&":
				return "&amp;";
			case "'":
				return "&apos;";
			case '"':
				return "&quot;";
			default:
				return "";
		}
	});
}

/**
 * Remove leading tabs or spaces before each line of a string.\
 * Used as a tagged template literal.
 */
export function dedent(strings: TemplateStringsArray, ...values: unknown[]): string {
	return strings
		.reduce((acc, cur, i) => {
			// eslint-disable-next-line @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-base-to-string
			return `${acc}${values[i - 1] ?? ""}${cur}`;
		}, "")
		.replaceAll(/^(\t| {4})+/gm, "");
}

/**
 * Turns a number into its ordinal form.
 * @example 1st
 * @example 11th
 * @example 2nd
 */
export function ordinal(num: number): string {
	const lastDigit = num % 10;
	const secondLastDigit = Math.floor(num / 10) % 10;

	if (secondLastDigit === 1) {
		return `${num}th`;
	} else if (lastDigit === 1) {
		return `${num}st`;
	} else if (lastDigit === 2) {
		return `${num}nd`;
	} else if (lastDigit === 3) {
		return `${num}rd`;
	}
	return `${num}th`;
}

/**
 * Makes hidden text to be used in a message. The text won't show up in the message but if it's a link, it will still embed.
 */
export function messageHiddenText(text: string) {
	// eslint-disable-next-line no-irregular-whitespace
	return ` ||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​|| ${text}` as const;
}
