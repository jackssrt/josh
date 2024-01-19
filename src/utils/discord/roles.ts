import type { GuildMember, Role, Snowflake } from "discord.js";
import { Collection } from "discord.js";
/**
 * Gets all the GuildMembers that have *all* provided Roles.
 * @param roles An array of Roles to check
 * @returns A collection of GuildMembers keyed by their ids
 */
export function membersWithRoles(roles: Role[]): Collection<Snowflake, GuildMember> {
	return roles.reduce((acc, v) => {
		return acc.intersect(v.members);
	}, roles[0]?.members ?? new Collection<Snowflake, GuildMember>());
}

/**
 * Gets all the roles that are under the anchor role in the same category.
 * @param anchor The anchor role
 * @returns Roles that are under the anchor role in the same category
 */
export async function getLowerRolesInSameCategory(anchor: Role) {
	const roles: Role[] = [];
	let collecting = false;
	for (const v of (await anchor.guild.roles.fetch()).sort((a, b) => b.position - a.position).values()) {
		if (v.name === "@everyone") continue;
		if (collecting) {
			if (roleIsCategory(v)) collecting = false;
			else roles.push(v);
		} else {
			if (v.id === anchor.id) collecting = true;
		}
	}
	return roles;
}

/**
 * Checks whether a role is a category role.
 * @param role The role to check
 */
export function roleIsCategory(role: Role): boolean {
	return role.name.match(/⠀+[A-Z]/g) !== null && role.hexColor !== "#010101";
}
