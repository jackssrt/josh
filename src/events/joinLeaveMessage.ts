import type { Collection, GuildMember, PartialGuildMember, TextChannel } from "discord.js";
import { channelMention, roleMention, userMention } from "discord.js";
import type Client from "../client.js";
import { BOOYAH_EMOJI } from "../emojis.js";
import getEnv from "../env.js";
import type Event from "../event.js";
import { dedent, formatNumberIntoNth, impersonate, membersWithRole, parallel } from "../utils.js";
export async function onMemberJoin(client: Client<true>, member: GuildMember) {
	const allMembers = membersWithRole([(await member.guild.roles.fetch(getEnv("MEMBER_ROLE_ID")))!]);
	// adds the new member to the collection if they aren't already in it
	allMembers.set(member.id, member);
	await parallel(
		async () => {
			const channel = (await client.channels.fetch(getEnv("GENERAL_CHANNEL_ID"))) as TextChannel;
			await channel.send(dedent`Welcome to Splat Squad, ${userMention(member.id)}! 👋
	We're a tight knit splatoon community. We've invited (almost) everyone from splatoon!
	You can see a cool graph of who invited whom in ${channelMention(getEnv("INFO_CHANNEL_ID"))}!
	Remember to pick up some roles at ${channelMention(getEnv("GET_ROLES_CHANNEL_ID"))}
	And most importantly have fun! ${BOOYAH_EMOJI}
	You're our ${formatNumberIntoNth(allMembers.size)} member, ${roleMention(getEnv("GREETER_ROLE_ID"))}s come say hi!`);
		},
		async () => {
			const channel = (await client.channels.fetch(getEnv("JOIN_LEAVE_CHANNEL_ID"))) as TextChannel;
			await impersonate(
				client,
				member,
				channel,
				`🟢 ${userMention(member.user.id)} joined, member #${allMembers.size}`,
			);
		},
	);
}

export async function onMemberLeave(client: Client<true>, member: GuildMember | PartialGuildMember) {
	const allMembers: Collection<string, GuildMember | PartialGuildMember> = membersWithRole([
		(await member.guild.roles.fetch(getEnv("MEMBER_ROLE_ID")))!,
	]);
	// adds the new member to the collection if they aren't already in it
	allMembers.set(member.id, member);
	const channel = (await client.channels.fetch(getEnv("JOIN_LEAVE_CHANNEL_ID"))) as TextChannel;
	await impersonate(
		client,
		member.user,
		channel,
		`🔴 ${userMention(member.user.id)} left, member #${allMembers.size}`,
	);
}

export default [
	{
		event: "guildMemberAdd",
		async on({ client }, member) {
			if (member.user.bot) return;
			await onMemberJoin(client, member);
		},
	} as Event<"guildMemberAdd">,
	{
		event: "guildMemberRemove",
		async on({ client }, member) {
			if (member.user.bot) return;
			await onMemberLeave(client, member);
		},
	} as Event<"guildMemberRemove">,
];
