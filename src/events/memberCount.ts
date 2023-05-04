import type { Guild, VoiceChannel } from "discord.js";
import getEnv from "../env.js";
import type Event from "../event.js";
import { membersWithRoles, pluralize } from "../utils.js";

export async function updateMemberCount(guild: Guild) {
	const channel = (await guild.channels.fetch(getEnv("MEMBER_COUNT_CHANNEL_ID"))) as VoiceChannel;
	const members = membersWithRoles([(await guild.roles.fetch(getEnv("MEMBER_ROLE_ID")))!]);
	const text = `👥・${members.size} ${pluralize("member", members.size)}`;
	if (channel.name !== text) await channel.setName(text);
	return members.size;
}

export default [
	{
		event: "guildMemberUpdate",
		async on(_, oldMember, newMember) {
			if (
				newMember.guild.id === getEnv("GUILD_ID") &&
				// oldMemberHasRole xor newMemberHasRole
				oldMember.roles.cache.has(getEnv("MEMBER_ROLE_ID")) !==
					newMember.roles.cache.has(getEnv("MEMBER_ROLE_ID"))
			)
				await updateMemberCount(newMember.guild);
		},
	} as Event<"guildMemberUpdate">,
	{
		event: "ready",
		async on({ client }) {
			await updateMemberCount(await client.guilds.fetch(getEnv("GUILD_ID")));
		},
	} as Event<"ready">,
];
