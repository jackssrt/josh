import type { Snowflake } from "discord.js";
import {
	AttachmentBuilder,
	GuildMember,
	TimestampStyles,
	inlineCode,
	roleMention,
	time,
	userMention,
} from "discord.js";
import type { Vector } from "ngraph.forcelayout";
import createLayout from "ngraph.forcelayout";
import createGraph from "ngraph.graph";
import sharp from "sharp";
import database from "../database.js";
import { reportError } from "../errorhandler.js";
import { updateStaticMessage } from "../staticMessages.js";
import { embeds } from "../utils/discord/embeds.js";
import { getLowerRolesInSameCategory, membersWithRoles } from "../utils/discord/roles.js";
import { scaleNumber } from "../utils/math.js";
import { parallel } from "../utils/promise.js";
import { dedent, escapeXml, pluralize } from "../utils/string.js";
import type Client from "./../client.js";
import createEvent from "./../commandHandler/event.js";

const INVITE_GRAPH_NAME_REGEX = /[^ \p{L}]/gu;

async function makeInviteGraph(client: Client<true>, invites: Record<Snowflake, Snowflake>): Promise<Buffer> {
	// Create the graph
	const graph = createGraph<[string, boolean]>();
	await parallel(
		Object.entries(invites).map(async ([invitee, inviter]) => {
			const [inviterMember, inviteeMember] = await parallel(
				client.guild.members.fetch(inviter).catch(() =>
					client.users.fetch(inviter).catch(() => {
						// pass
					}),
				),
				client.guild.members.fetch(invitee).catch(() =>
					client.users.fetch(invitee).catch(() => {
						// pass
					}),
				),
			);
			if (!inviterMember || !inviteeMember) return;
			graph.addNode(inviter, [inviterMember.displayName, inviterMember instanceof GuildMember]);
			graph.addNode(invitee, [inviteeMember.displayName, inviteeMember instanceof GuildMember]);
			graph.addLink(inviter, invitee);
		}),
	);

	// Calculate the layout
	const layout = createLayout(graph);
	for (let index = 0; index < 10_000 && !layout.step(); index++) {
		// pass
	}
	if (!layout.step())
		reportError({
			title: "Member graph simulation uncompleted",
			description: dedent`
				${inlineCode("for (let i = 0; i < INCREMENT_THIS && !layout.step(); i++) {")}
								Increment the number to increase the cap.
			`,
		});
	const nodes: Vector[] = [];
	graph.forEachNode((v) => {
		nodes.push(layout.getNodePosition(v.id));
	});

	// Calculate the scale
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

	// Start drawing
	let svg = `<svg version="1.1" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
	let text = "";

	// Draw links
	graph.forEachLink((link) => {
		const posA = scaleVector(layout.getNodePosition(link.fromId));
		const posB = scaleVector(layout.getNodePosition(link.toId));

		svg += `<line x1="${posA.x}" y1="${posA.y}" x2="${posB.x}" y2="${posB.y}" stroke="#0e7008" stroke-width="10" />`;
	});

	// Draw nodes
	graph.forEachNode((v) => {
		const pos = layout.getNodePosition(v.id);
		const scaledPos = scaleVector(pos);
		// Draw a node as a circle
		// darken the circle if the member left the server :(
		svg += dedent`<circle cx="${scaledPos.x}" cy="${scaledPos.y}" r="30" fill="${v.data[1] ? "#17a80d" : "#0e6508"}"/>`;
		text += `<text x="${scaledPos.x}" y="${
			scaledPos.y + 5
		}" text-anchor="middle" dominant-baseline="middle" fill="white" font-family="splatoon2" font-size="30px">${escapeXml(v.data[0].replaceAll(INVITE_GRAPH_NAME_REGEX, "").replaceAll(/  +/g, " ").trim())}</text>`;
	});

	// Finish drawing
	svg += text;
	svg += "</svg>";
	return sharp(Buffer.from(svg)).png({ force: true }).toBuffer();
}

export async function updateStatsMessage(client: Client<true>) {
	const members = membersWithRoles([client.memberRole]);
	const invites = await database.getInviteRecord();
	const invitesSet = new Set([...Object.keys(invites), ...Object.values(invites)]);
	const colorRoles = await getLowerRolesInSameCategory(client.colorsRoleCategory);
	// members - invites
	const toBeAdded = [...members.keys()].filter((v) => !invitesSet.has(v));
	await updateStaticMessage(client.statsChannel, "stats-message", {
		...(await embeds(
			(b) =>
				b.setTitle("Server information").addFields({
					name: "Released",
					value: time(new Date(1_675_696_320_000), TimestampStyles.RelativeTime),
					inline: true,
				}),
			async (b) =>
				b.setTitle("Roles").setDescription(
					(await client.guild.roles.fetch())
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
					.addFields(
						{
							name: "Member count",
							value: `${members.size} ${pluralize("member", members.size)}`,
						},

						...(toBeAdded.length > 0
							? [
									{
										name: "To be added",
										value: toBeAdded.map((v) => userMention(v)).join(" "),
									},
								]
							: []),
					)
					.setImage("attachment://invites.png"),
		)),
		files: [new AttachmentBuilder(await makeInviteGraph(client, invites)).setName("invites.png")],
	});
}

export default [
	createEvent({
		event: "guildMemberUpdate",
		async on({ client }, oldMember, newMember) {
			if (
				newMember.guild !== client.guild &&
				// oldMemberHasRole xor newMemberHasRole
				oldMember.roles.cache.has(process.env.MEMBER_ROLE_ID) !==
					newMember.roles.cache.has(process.env.MEMBER_ROLE_ID)
			)
				return;
			await updateStatsMessage(client);
		},
	}),
	createEvent({
		event: "guildMemberRemove",
		async on({ client }, member) {
			if (member.guild !== client.guild) return;
			await updateStatsMessage(client);
		},
	}),
	createEvent({
		event: "ready",
		async on({ client }) {
			await updateStatsMessage(client);
		},
	}),
];
