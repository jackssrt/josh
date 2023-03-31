import { randomInt } from "crypto";
import { ChannelType } from "discord.js";
import getEnv from "../env.js";
import type Event from "../event.js";
import { impersonate, parallel } from "../utils.js";
const EMOJI = "<:face_holding_back_tears_old:1091477929940238416>";

export default {
	event: "messageCreate",
	async on({ client }, message) {
		if (!message.member || message.channel.type !== ChannelType.GuildText) return;
		if (message.content.includes(EMOJI) && message.member.id !== getEnv("APRIL_FOOLS_TARGET"))
			return await parallel(
				message.delete(),
				impersonate(
					client,
					message.member,
					message.channel,
					message.content.replace(EMOJI, ":face_holding_back_tears:"),
				),
			);

		if (randomInt(0, 11) === 0)
			return await parallel(
				message.delete(),
				impersonate(client, message.member, message.channel, `${message.content} AMONG US!!`),
			);
	},
} as Event<"messageCreate">;
