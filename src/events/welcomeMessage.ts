import type { Message } from "discord.js";
import { Colors, MessageType, channelMention, roleMention, userMention } from "discord.js";
import type Client from "../client.js";
import { BOOYAH_EMOJI } from "../emojis.js";
import getEnv from "../env.js";
import { dedent, embeds, formatNumberIntoNth, membersWithRoles } from "../utils.js";
import type Event from "./../event.js";

export async function sendWelcomeMessage(client: Client<true>, message: Message<true>) {
	const { member } = message;
	if (!member) return;
	const allMembers = membersWithRoles([client.memberRole]);
	// adds the new member to the collection if they aren't already in it
	allMembers.set(member.id, member);
	await message.reply({
		content: `${userMention(member.id)} ${roleMention(getEnv("GREETER_ROLE_ID"))}`,
		...(await embeds((b) =>
			b
				.setTitle(`Welcome ${member.displayName}! 👋`)
				.setDescription(
					dedent`We're a tight knit splatoon community, we've invited (almost) everyone from splatoon!
						Please read the rules in ${channelMention(getEnv("RULES_CHANNEL_ID"))},
						and if you want, pick up some more roles in <id:customize>.
						But most importantly, have fun! ${BOOYAH_EMOJI}`,
				)
				.setFooter({ text: `You're our ${formatNumberIntoNth(allMembers.size)} member!` })
				.setTimestamp(new Date())
				.setColor(Colors.Blurple),
		)),
	});
}

export default {
	event: "messageCreate",
	async on({ client }, message) {
		if (!message.inGuild() || !message.member || message.type !== MessageType.UserJoin) return;
		if (getEnv("JOIN_IGNORE_IDS").split(",").includes(message.author.id)) return await message.delete();
		await sendWelcomeMessage(client, message);
	},
} as Event<"messageCreate">;
