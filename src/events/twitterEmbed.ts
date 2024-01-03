import database from "../database.js";
import { canReplaceMessage, replaceMessage } from "../utils/discord/messages.js";
import createEvent from "./../event.js";

const REGEX = /(?:https?:)?\/\/(?:[A-z]+\.)?(twitter|x)\.com\/@?([A-z0-9_]+)\/status\/([0-9]+)\/?/;

export default createEvent({
	event: "messageCreate",
	async on({ client }, message) {
		if (
			!canReplaceMessage(message) ||
			message.guild !== client.guild ||
			message.author.bot ||
			!(await database.getBooleanFlag("message.fxtwitter.enabled"))
		)
			return;
		const newContent = message.content.replace(REGEX, (match, url: string) => match.replace(url, "fxtwitter"));
		if (newContent === message.content) return;

		await replaceMessage(client, message, newContent);
	},
});
