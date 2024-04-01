import createEvent from "@/commandHandler/event.js";
import { canReplaceMessage, replaceMessage } from "@/utils/discord/messages.js";
import { ChannelType } from "discord.js";
import { randomInt } from "node:crypto";

export default createEvent({
	event: "messageCreate",
	async on({ client }, message) {
		if (
			!message.member ||
			message.channel.type !== ChannelType.GuildText ||
			message.attachments.size > 0 ||
			message.embeds.length > 0 ||
			!canReplaceMessage(message)
		)
			return;

		if (randomInt(0, 11) === 0) return await replaceMessage(client, message, `${message.content} AMONG US!!`);
	},
});
