import type { Collection, GuildMember, PartialGuildMember } from "discord.js";
import { Colors, channelMention, roleMention, userMention } from "discord.js";
import type Client from "../client.js";
import { BOOYAH_EMOJI } from "../emojis.js";
import getEnv from "../env.js";
import type Event from "../event.js";
import { dedent, embeds, formatNumberIntoNth, impersonate, membersWithRoles, parallel } from "../utils.js";

export async function onMemberJoin(client: Client<true>, member: GuildMember) {
	const allMembers = membersWithRoles([client.memberRole]);
	// adds the new member to the collection if they aren't already in it
	allMembers.set(member.id, member);
	await parallel(
		async () => {
			await client.generalChannel.send({
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
		},
		async () => {
			await impersonate(
				client,
				member,
				client.joinLeaveChannel,
				`🟢 ${userMention(member.user.id)} joined, member #${allMembers.size}`,
			);
		},
	);
}

export async function onMemberLeave(client: Client<true>, member: GuildMember | PartialGuildMember) {
	const allMembers: Collection<string, GuildMember | PartialGuildMember> = membersWithRoles([client.memberRole]);
	// adds the new member to the collection if they aren't already in it
	allMembers.set(member.id, member);

	await impersonate(
		client,
		member.user,
		client.joinLeaveChannel,
		`🔴 ${userMention(member.user.id)} left, member #${allMembers.size}`,
	);
}

export default [
	{
		event: "guildMemberAdd",
		async on({ client }, member) {
			if (member.user.bot || member.guild !== client.guild) return;
			await onMemberJoin(client, member);
		},
	} as Event<"guildMemberAdd">,
	{
		event: "guildMemberRemove",
		async on({ client }, member) {
			if (member.user.bot || member.guild !== client.guild) return;
			await onMemberLeave(client, member);
		},
	} as Event<"guildMemberRemove">,
];
