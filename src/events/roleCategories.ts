import type { GuildMember, Role } from "discord.js";
import type Event from "../event.js";
import { roleIsCategory } from "../utils.js";

export async function updateRoleCategories(member: GuildMember) {
	let roleCategory = undefined as Role | undefined;
	for (const v of (await member.guild.roles.fetch()).sort((a, b) => b.position - a.position).values()) {
		if (v.name === "@everyone") continue;
		if (roleIsCategory(v)) {
			if (roleCategory?.members.has(member.id))
				// member has no roles in role category
				// remove the role category from them
				await member.roles.remove(roleCategory, "Automatic role category remove");
			roleCategory = v;
		} else if (roleCategory && v.members.has(member.id)) {
			if (!roleCategory.members.has(member.id))
				// give them the role category
				await member.roles.add(roleCategory, "Automatic role category add");
			// member has role in role category
			roleCategory = undefined;
		}
	}
	if (roleCategory && roleCategory.members.has(member.id)) {
		// member has no roles in last role category
		// remove the role category from them
		await member.roles.remove(roleCategory, "Automatic role category remove");
	}
}

export default {
	event: "guildMemberUpdate",
	async on(_, __, member) {
		await updateRoleCategories(member);
	},
} as Event<"guildMemberUpdate">;
