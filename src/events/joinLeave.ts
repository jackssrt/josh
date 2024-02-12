import type { Collection, PartialGuildMember } from "discord.js";
import { Colors, GuildMember, userMention } from "discord.js";
import type Client from "../client.js";
import createEvent from "../commandHandler/event.js";
import database from "../database.js";
import { embeds } from "../utils/discord/embeds.js";
import { impersonate } from "../utils/discord/messages.js";
import { membersWithRoles } from "../utils/discord/roles.js";

export async function onMemberJoin(client: Client<true>, member: GuildMember) {
	const allMembers = membersWithRoles([client.memberRole]);
	// adds the new member to the collection if they aren't already in it
	allMembers.set(member.id, member);
	await database.addMember(member);

	const memberIndex = await database.getMemberIndex(member);
	await impersonate(
		client,
		member,
		client.joinLeaveChannel,
		await embeds((b) =>
			b
				.setColor(Colors.Green)
				.setDescription(`**${userMention(member.user.id)} joined**`)
				.addFields(
					{ name: "Member #", value: `${memberIndex !== undefined ? memberIndex + 1 : "???"}`, inline: true },
					{ name: "New member count", value: `${allMembers.size}`, inline: true },
				),
		),
	);
}

export async function onMemberLeave(client: Client<true>, member: GuildMember | PartialGuildMember) {
	const allMembers: Collection<string, GuildMember | PartialGuildMember> = membersWithRoles([client.memberRole]);
	// remove the old member from the collection if they aren't already removed
	allMembers.delete(member.id);

	const memberIndex = await database.getMemberIndex(member);
	await impersonate(
		client,
		member instanceof GuildMember ? member : member.user,
		client.joinLeaveChannel,
		await embeds((b) =>
			b
				.setColor(Colors.Red)
				.setDescription(`**${userMention(member.user.id)} left**`)
				.addFields(
					{ name: "Member #", value: `${memberIndex !== undefined ? memberIndex + 1 : "???"}`, inline: true },
					{ name: "New member count", value: `${allMembers.size}`, inline: true },
				),
		),
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
