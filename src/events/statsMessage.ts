import { renderAsync } from "@resvg/resvg-js";
import axios from "axios";
import type { Guild, GuildMember, Snowflake } from "discord.js";
import { AttachmentBuilder, TimestampStyles, inlineCode, roleMention, time, userMention } from "discord.js";
import type { Layout, Vector } from "ngraph.forcelayout";
import createLayout from "ngraph.forcelayout";
import type { Graph, Node } from "ngraph.graph";
import createGraph from "ngraph.graph";
import sharp from "sharp";
import database from "../database.js";
import {
	dedent,
	embeds,
	escapeXml,
	getLowerRolesInSameCategory,
	membersWithRoles,
	parallel,
	pluralize,
	reportError,
	scaleNumber,
	updateStaticMessage,
} from "../utils.js";
import type Client from "./../client.js";
import createEvent from "./../event.js";
import logger from "./../logger.js";

function filterName(name: string): string {
	return name.replace(/[^a-zA-Z]|\(.*\)/g, "");
}

async function populateGraph(graph: Graph<GuildMember>, guild: Guild, invites: Record<Snowflake, Snowflake>) {
	await parallel(
		Object.entries(invites).map(async ([invitee, inviter]) => {
			const [inviterMember, inviteeMember] = await parallel(
				guild.members.fetch(inviter).catch(() => undefined),
				guild.members.fetch(invitee).catch(() => undefined),
			);
			if (!inviterMember || !inviteeMember) return;
			graph.addNode(inviter, inviterMember);
			graph.addNode(invitee, inviteeMember);
			graph.addLink(inviter, invitee);
		}),
	);
	const nodes: Node<GuildMember>[] = [];
	graph.forEachNode((v) => void nodes.push(v));
	return nodes;
}

function layoutGraph(graph: Graph<GuildMember>) {
	const layout = createLayout(graph);
	for (let i = 0; i < 1000 && !layout.step(); i++) {
		// pass
	}
	if (!layout.step())
		reportError({
			title: "Member graph simulation uncompleted",
			description: dedent`${inlineCode("for (let i = 0; i < INCREMENT_THIS && !layout.step(); i++) {")}
				Increment the number to increase the cap.`,
		});
	return layout;
}

async function downloadAvatars(nodes: Node<GuildMember>[]) {
	const avatars = new Map<GuildMember, string>();
	await parallel(
		nodes.map(async (v) =>
			avatars.set(
				v.data,
				(
					await sharp(
						(await axios.get<ArrayBuffer>(v.data.displayAvatarURL(), { responseType: "arraybuffer" })).data,
					)
						.png({ force: true })
						.toBuffer()
				).toString("base64"),
			),
		),
	);
	return avatars;
}

async function renderGraph(
	graph: Graph<GuildMember>,
	layout: Layout<Graph<GuildMember>>,
	nodes: Node<GuildMember>[],
	avatars: Map<GuildMember, string>,
) {
	const nodePositions: Vector[] = [];
	graph.forEachNode((v) => {
		nodePositions.push(layout.getNodePosition(v.id));
	});
	const smallestX = Math.min(...nodePositions.map((v) => v.x));
	const largestX = Math.max(...nodePositions.map((v) => v.x));
	const smallestY = Math.min(...nodePositions.map((v) => v.y));
	const largestY = Math.max(...nodePositions.map((v) => v.y));
	const width = 1000;
	const height = 1000;
	const scale = ((largestX - smallestX) / width) * 250;

	const paddingWidth = 128;
	const paddingHeight = 128;
	function scaleVector(a: Vector): Vector {
		return {
			x: scaleNumber(a.x, [smallestX, largestX], [paddingWidth, width - paddingWidth]) - smallestX,
			y: scaleNumber(a.y, [smallestY, largestY], [paddingHeight, height - paddingHeight]) - smallestY,
		};
	}

	let svg = dedent`<svg version="1.1" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
	<defs>
        ${nodes.map((v) => {
			const pos = scaleVector(layout.getNodePosition(v.id));
			return `<clipPath id="circleView-${v.id}">
            			<circle cx="${pos.x}" cy="${pos.y}" r="${30 * scale}" fill="#FFFFFF" />
        			</clipPath>`;
		})}
    </defs>`;

	// Draw edges
	graph.forEachLink((link) => {
		const posA = scaleVector(layout.getNodePosition(link.fromId));
		const posB = scaleVector(layout.getNodePosition(link.toId));

		svg += `<line x1="${posA.x}" y1="${posA.y}" x2="${posB.x}" y2="${posB.y}" stroke="#0e7008" stroke-width="${
			10 * scale
		}" />`;
	});
	let text = "";
	nodes.forEach((v) => {
		const pos = scaleVector(layout.getNodePosition(v.id));
		// Draw a node as a circle
		const colorScale = 1 + (v.links?.size ?? 0) / 3;
		const color = [23 * colorScale, 168 * colorScale, 13 * colorScale] as const;

		svg += `<circle cx="${pos.x}" cy="${pos.y}" r="${30 * colorScale * scale}" fill="rgb(${color[0]}, ${
			color[1]
		}, ${color[2]})"/>`;
		text += `<text x="${pos.x}" y="${
			pos.y + 30 * colorScale * scale
		}" text-anchor="middle" dominant-baseline="middle" fill="white" font-family="splatoon2" font-size="${
			30 * scale
		}px">${escapeXml(filterName(v.data.displayName))}</text>`;
		svg += `<image xlink:href="data:image/png;base64,${avatars.get(v.data)}" height="${60 * scale}" width="${
			60 * scale
		}" x="${pos.x - 30 * scale}" y="${pos.y - 30 * scale}" clip-path="url(#circleView-${v.id})"/>`;
	});
	svg += text;
	svg += "</svg>";
	logger.debug("statsMessage image");
	logger.debug(svg);
	return (await renderAsync(svg, { font: { fontFiles: ["./assets/splatoon2.otf"] } })).asPng();
}

async function makeInviteGraph(guild: Guild, invites: Record<Snowflake, Snowflake>): Promise<Buffer> {
	const graph = createGraph<GuildMember>();
	const nodes = await populateGraph(graph, guild, invites);
	const avatars = await downloadAvatars(nodes);
	const layout = layoutGraph(graph);
	return await renderGraph(graph, layout, nodes, avatars);
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
					value: `${time(new Date(1675696320000), TimestampStyles.RelativeTime)}`,
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

						...(toBeAdded.length
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
		files: [new AttachmentBuilder(await makeInviteGraph(client.guild, invites)).setName("invites.png")],
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
