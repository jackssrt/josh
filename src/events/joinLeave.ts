import type { Collection, GuildMember, PartialGuildMember } from "discord.js";
import { userMention } from "discord.js";
import type Client from "../client.js";
import createEvent from "../event.js";
import { impersonate } from "../utils/discord/messages.js";
import { membersWithRoles } from "../utils/discord/roles.js";

export async function onMemberJoin(client: Client<true>, member: GuildMember) {
	const allMembers = membersWithRoles([client.memberRole]);
	// adds the new member to the collection if they aren't already in it
	allMembers.set(member.id, member);

	await impersonate(
		client,
		member,
		client.joinLeaveChannel,
		`🟢 ${userMention(member.user.id)} joined, member #${allMembers.size}`,
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
	createEvent({
		event: "guildMemberAdd",
		async on({ client }, member) {
			if (
				member.user.bot ||
				member.guild !== client.guild ||
				process.env.JOIN_IGNORE_IDS.split(",").includes(member.id)
			)
				return;
			await onMemberJoin(client, member);
		},
	}),
	createEvent({
		event: "guildMemberRemove",
		async on({ client }, member) {
			if (
				member.user.bot ||
				member.guild !== client.guild ||
				process.env.JOIN_IGNORE_IDS.split(",").includes(member.id)
			)
				return;
			await onMemberLeave(client, member);
		},
	}),
];
