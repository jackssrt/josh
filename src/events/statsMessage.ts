import consola from "consola";
import type { Guild } from "discord.js";
import { AttachmentBuilder, TimestampStyles, roleMention, time, type TextChannel } from "discord.js";
import type { Vector } from "ngraph.forcelayout";
import createLayout from "ngraph.forcelayout";
import createGraph from "ngraph.graph";
import sharp from "sharp";
import database from "../database.js";
import getEnv from "../env.js";
import {
	dedent,
	embeds,
	getLowerRolesInSameCategory,
	membersWithRoles,
	parallel,
	pluralize,
	scaleNumber,
	updateStaticMessage,
} from "../utils.js";
import type Client from "./../client.js";
import type Event from "./../event.js";

async function makeInviteGraph(guild: Guild): Promise<Buffer> {
	const graph = createGraph<string>();
	await parallel(
		Object.entries(await database.getInviteRecord()).map(async ([invitee, inviter]) => {
			const [inviterMember, inviteeMember] = await parallel(
				guild.members.fetch(inviter).catch(() => undefined),
				guild.members.fetch(invitee).catch(() => undefined),
			);
			if (!inviterMember || !inviteeMember) return;
			graph.addNode(inviter, inviterMember.displayName);
			graph.addNode(invitee, inviteeMember.displayName);
			graph.addLink(inviter, invitee);
		}),
	);
	const layout = createLayout(graph); //, { springLength: 10 });
	for (let i = 0; i < 100 && !layout.step(); i++) {
		// pass
	}
	const nodes: Vector[] = [];
	graph.forEachNode((v) => {
		nodes.push(layout.getNodePosition(v.id));
	});
	const smallestX = Math.min(...nodes.map((v) => v.x));
	const largestX = Math.max(...nodes.map((v) => v.x));
	const smallestY = Math.min(...nodes.map((v) => v.y));
	const largestY = Math.max(...nodes.map((v) => v.y));
	const width = 1000;
	const height = 1000;
	const paddingWidth = 128;
	const paddingHeight = 128;
	function scaleVector(a: Vector): Vector {
		return {
			x: scaleNumber(a.x, [smallestX, largestX], [paddingWidth, width - paddingWidth]) - smallestX,
			y: scaleNumber(a.y, [smallestY, largestY], [paddingHeight, height - paddingHeight]) - smallestY,
		};
	}
	let svg = `<svg version="1.1" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;

	// Draw edges
	graph.forEachLink((link) => {
		const posA = scaleVector(layout.getNodePosition(link.fromId));
		const posB = scaleVector(layout.getNodePosition(link.toId));

		svg += `<line x1="${posA.x}" y1="${posA.y}" x2="${posB.x}" y2="${posB.y}" stroke="#0e7008" stroke-width="10" />`;
	});
	let text = "";
	graph.forEachNode((v) => {
		const pos = layout.getNodePosition(v.id);
		const scaledPos = scaleVector(pos);
		consola.log("circle", scaledPos);
		// Draw a node as a circle
		svg += dedent`<circle cx="${scaledPos.x}" cy="${scaledPos.y}" r="30" fill="#17a80d"/>`;
		text += `<text x="${scaledPos.x}" y="${
			scaledPos.y + 5
		}" text-anchor="middle" dominant-baseline="middle" fill="white" font-family="splatoon2
			" font-size="30px">${v.data}</text>`;
	});
	svg += text;
	svg += "</svg>";

	return sharp(Buffer.from(svg)).png({ force: true }).toBuffer();
}

export async function updateStatsMessage(client: Client<true>) {
	const channel = (await client.guild.channels.fetch(getEnv("STATS_CHANNEL_ID"))!) as TextChannel;

	const members = membersWithRoles([(await client.guild.roles.fetch(getEnv("MEMBER_ROLE_ID")))!]);
	const colorRoles = await getLowerRolesInSameCategory(
		(await client.guild.roles.fetch(getEnv("COLORS_ROLE_CATEGORY_ID")))!,
	);
	await updateStaticMessage(channel, "stats-message", {
		...(await embeds(
			(b) =>
				b.setTitle("Server information").addFields({
					name: "Released",
					value: `${time(new Date(1675696320000), TimestampStyles.RelativeTime)}`,
					inline: true,
				}),
			async (b) =>
				b.setTitle("Roles").setDescription(
					(
						await client.guild.roles.fetch()
					)
						.filter((v) => v.members.size > 0 && v.name !== "@everyone" && !colorRoles.includes(v))
						.sort((a, b) => b.position - a.position)
						.map(
							(v) =>
								`${roleMention(v.id)} - ${v.members.size} (${Math.round(
									(v.members.size / client.guild.memberCount) * 100,
								)}%)`,
						)
						.join("\n"),
				),
			(b) =>
				b
					.setTitle("Member statistics")
					.addFields({
						name: "Member count",
						value: `${members.size} ${pluralize("member", members.size)}`,
						inline: true,
					})
					.setImage("attachment://invites.png"),
		)),
		files: [new AttachmentBuilder(await makeInviteGraph(client.guild)).setName("invites.png")],
	});
}

export default [
	{
		event: "guildMemberUpdate",
		async on({ client }, oldMember, newMember) {
			if (
				newMember.guild !== client.guild &&
				// oldMemberHasRole xor newMemberHasRole
				oldMember.roles.cache.has(getEnv("MEMBER_ROLE_ID")) !==
					newMember.roles.cache.has(getEnv("MEMBER_ROLE_ID"))
			)
				return;
			await updateStatsMessage(client);
		},
	} as Event<"guildMemberUpdate">,
	{
		event: "guildMemberRemove",
		async on({ client }) {
			await updateStatsMessage(client);
		},
	} as Event<"guildMemberRemove">,
	{
		event: "ready",
		async on({ client }) {
			await updateStatsMessage(client);
		},
	} as Event<"ready">,
];