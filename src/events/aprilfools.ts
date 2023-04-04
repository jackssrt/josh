import { randomInt } from "crypto";
import { ChannelType } from "discord.js";
import type Event from "../event.js";
import { impersonate, parallel } from "../utils.js";

export default {
	event: "messageCreate",
	async on({ client }, message) {
		if (!message.member || message.channel.type !== ChannelType.GuildText || message.attachments.size > 0 || message.embeds.length > 0) return;

		if (randomInt(0, 11) === 0)
			return await parallel(
				message.delete(),
				impersonate(client, message.member, message.channel, `${message.content} AMONG US!!`),
			);
	},
} as Event<"messageCreate">;
