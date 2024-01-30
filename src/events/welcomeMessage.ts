import type { Message } from "discord.js";
import { Colors, MessageType, channelMention, roleMention, userMention } from "discord.js";
import database from "../database.js";
import { BOOYAH_EMOJI } from "../emojis.js";
import { embeds } from "../utils/discord/embeds.js";
import { dedent, ordinal } from "../utils/string.js";
import createEvent from "./../event.js";

export async function sendWelcomeMessage(message: Message<true>) {
	const { member } = message;
	if (!member) return;
	const memberIndex = await database.getMemberIndex(member);
	await message.reply({
		content: `${userMention(member.id)} ${roleMention(process.env.GREETER_ROLE_ID)}`,
		...(await embeds((b) =>
			b
				.setTitle(`Welcome ${member.displayName}! 👋`)
				.setDescription(
					dedent`We're a tight knit splatoon community, we've invited (almost) everyone from splatoon!
						Please read the rules in ${channelMention(process.env.RULES_CHANNEL_ID)},
						and if you want, pick up some more roles in <id:customize>.
						But most importantly, have fun! ${BOOYAH_EMOJI}`,
				)
				.setFooter({ text: `You're our ${memberIndex ? ordinal(memberIndex + 1) : "???th"} member!` })
				.setTimestamp(new Date())
				.setColor(Colors.Blurple),
		)),
	});
}

export default createEvent({
	event: "messageCreate",
	async on({ client }, message) {
		if (
			!message.inGuild() ||
			!message.member ||
			message.type !== MessageType.UserJoin ||
			message.guild !== client.guild
		)
			return;
		if (process.env.JOIN_IGNORE_IDS.split(",").includes(message.author.id)) return await message.delete();
		await sendWelcomeMessage(message);
	},
});
