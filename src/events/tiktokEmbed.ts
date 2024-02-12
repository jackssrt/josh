import database from "../database.js";
import { canReplaceMessage, replaceMessage } from "../utils/discord/messages.js";
import { TIKTOK_VIDEO_LINK_REGEX } from "../utils/regex.js";
import createEvent from "./../commandHandler/event.js";

export default createEvent({
	event: "messageCreate",
	async on({ client }, message) {
		if (
			!canReplaceMessage(message) ||
			message.guild !== client.guild ||
			message.author.bot ||
			!(await database.getBooleanFlag("message.tiktokEmbed.enabled"))
		)
			return;
		const newContent = message.content.replace(TIKTOK_VIDEO_LINK_REGEX, (match, domain: string) =>
			match.replace(domain, "vxtiktok.com"),
		);
		if (newContent === message.content) return;

		await replaceMessage(client, message, newContent);
	},
});
