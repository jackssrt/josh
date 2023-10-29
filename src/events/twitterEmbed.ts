import database from "../database.js";
import { impersonate, parallel } from "../utils.js";
import createEvent from "./../event.js";

const REGEX = /(?:https?:)?\/\/(?:[A-z]+\.)?(twitter|x)\.com\/@?([A-z0-9_]+)\/status\/([0-9]+)\/?/;

export default createEvent({
	event: "messageCreate",
	async on({ client }, message) {
		if (
			!message.inGuild() ||
			message.guild !== client.guild ||
			message.author.bot ||
			message.channel.isThread() ||
			!(await database.getBooleanFlag("message.fxtwitter.enabled"))
		)
			return;
		const newContent = message.content.replace(REGEX, (match, url: string) => match.replace(url, "fxtwitter"));
		if (newContent === message.content) return;

		await parallel(
			message.delete(),
			impersonate(client, message.member ?? message.author, message.channel, {
				content: newContent,
				allowedMentions: {},
			}),
		);
	},
});
