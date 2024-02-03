/**
 * @link https://urlregex.com/
 */
export const LINK_REGEX =
	/((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=+$,\w]+@)?[A-Za-z0-9.-]+|(?:www\.|[-;:&=+$,\w]+@)[A-Za-z0-9.-]+)((?:\/[+~%/.\w\-_]*)?\??(?:[-+=&;%@.\w_]*)#?(?:[.!/\\\w]*))?)/;

/**
 * A regex to match a link to a tiktok video
 */
export const TIKTOK_VIDEO_LINK_REGEX =
	/https?:\/\/(?:www\.|vm\.|m\.)?(tiktok\.com)\/(((@[^/]+\/video|v)\/([^/]+))|\S+)/g;

/**
 * A regex to match a link to a tweet
 */
export const TWEET_LINK_REGEX = /(?:https?:)?\/\/(?:[a-zA-Z]+\.)?(twitter|x)\.com\/@?(\w+)\/status\/([0-9]+)\/?/g;

/**
 * A regex to remove all ansi colors from a string.
 */
// eslint-disable-next-line no-control-regex
export const COLORS_REGEX = /\u001b\[(.*?)m/g;
