import database from "../database.js";
import { canReplaceMessage, replaceMessage } from "../utils/discord/messages.js";
import { TWEET_LINK_REGEX } from "../utils/regex.js";
import createEvent from "./../commandHandler/event.js";

export default createEvent({
	event: "messageCreate",
	async on({ client }, message) {
		if (
			!canReplaceMessage(message) ||
			message.guild !== client.guild ||
			message.author.bot ||
			!(await database.getBooleanFlag("message.twitterEmbed.enabled"))
		)
			return;
		const newContent = message.content.replace(TWEET_LINK_REGEX, (match, url: string) =>
			match.replace(url, "fxtwitter"),
		);
		if (newContent === message.content) return;

		await replaceMessage(client, message, newContent);
	},
});
