/**
 * @link https://urlregex.com/
 */
export const LINK_REGEX =
	/((([A-Za-z]{3,9}:(?:\/\/)?)(?:[\w$&+,:;=-]+@)?[\d.A-Za-z-]+|(?:www\.|[\w$&+,:;=-]+@)[\d.A-Za-z-]+)((?:\/[\w%+./~-]*)?\??[\w%&+.;=@-]*#?[\w!./\\]*)?)/;

/**
 * A regex to match a link to a tiktok video
 */
export const TIKTOK_VIDEO_LINK_REGEX =
	/https?:\/\/(?:www\.|vm\.|m\.)?(tiktok\.com)\/(((@[^/]+\/video|v)\/([^/]+))|\S+)/g;

/**
 * A regex to match a link to a tweet
 */
export const TWEET_LINK_REGEX = /(?:https?:)?\/\/(?:[A-Za-z]+\.)?(twitter|x)\.com\/@?(\w+)\/status\/(\d+)\/?/g;

/**
 * A regex to remove all ansi colors from a string.
 */
// eslint-disable-next-line no-control-regex
export const COLORS_REGEX = /\u001B\[(.*?)m/g;
