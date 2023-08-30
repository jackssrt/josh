import type { TextBasedChannel } from "discord.js";
import { SQUID_SHUFFLE_EMOJI } from "../emojis.js";
import { impersonate, parallel } from "../utils.js";
import createEvent from "./../event.js";

const REGEX = /(?:https?:)?\/\/(?:[A-z]+\.)?(twitter|x)\.com\/@?([A-z0-9_]+)\/status\/([0-9]+)\/?/;

export default createEvent({
	event: "messageCreate",
	async on({ client }, message) {
		if (!message.inGuild() || message.channel.isThread()) return;
		const newContent = message.content.replace(REGEX, (match, url: string) => match.replace(url, "fxtwitter"));
		if (newContent === message.content) return;

		await parallel(message.delete(), async () => {
			if (message.mentions.users.size || message.mentions.roles.size || message.mentions.everyone) {
				const [msg, webhook] = await impersonate(
					client,
					message.member ?? message.author,
					// already checked before
					message.channel as Extract<TextBasedChannel, { fetchWebhooks: unknown }>,
					`${SQUID_SHUFFLE_EMOJI} Editing this message to avoid double pings...`,
				);
				await webhook.editMessage(msg.id, newContent);
			} else {
				await impersonate(
					client,
					message.member ?? message.author,
					// already checked before
					message.channel as Extract<TextBasedChannel, { fetchWebhooks: unknown }>,
					newContent,
				);
			}
		});
	},
});
