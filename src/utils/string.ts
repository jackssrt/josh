export function truncate(text: string, maxLength: number) {
	maxLength = Math.max(maxLength, 3);
	return text.length > maxLength ? text.slice(0, maxLength - 3) + "..." : text;
}

export function pluralize(word: string, count: number): string {
	return `${word}${count === 1 ? "" : "s"}`;
}

/**
 * @link https://stackoverflow.com/a/27979933
 */
export function escapeXml(unsafe: string) {
	return unsafe.replace(/[<>&'"]/g, function (c) {
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

export function dedent(strings: TemplateStringsArray, ...values: unknown[]): string {
	return strings
		.reduce((acc, cur, i) => {
			// eslint-disable-next-line @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-base-to-string
			return `${acc}${values[i - 1] ?? ""}${cur}`;
		}, "")
		.replace(/^(\t| {4})+/gm, "");
}

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

export function messageHiddenText(text: string) {
	// eslint-disable-next-line no-irregular-whitespace
	return ` ||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​|| ${text}` as const;
}
