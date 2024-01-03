/**
 * @link https://urlregex.com/
 */
export const LINK_REGEX =
	/((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=+$,\w]+@)?[A-Za-z0-9.-]+|(?:www\.|[-;:&=+$,\w]+@)[A-Za-z0-9.-]+)((?:\/[+~%/.\w\-_]*)?\??(?:[-+=&;%@.\w_]*)#?(?:[.!/\\\w]*))?)/;

/**
 * A regex to remove all ansi colors from a string.
 */
// eslint-disable-next-line no-control-regex
export const COLORS_REGEX = /\u001b\[(.*?)m/g;
