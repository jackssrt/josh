import axios from "axios";
import consola from "consola";
import { GuildScheduledEventEntityType, GuildScheduledEventPrivacyLevel, TimestampStyles } from "discord.js";
import { USER_AGENT } from "../client.js";
import database from "../database.js";
import getEnv from "../env.js";
import type Event from "../event.js";
import type { FestivalsApiResponse } from "../types/rotationNotifier.js";
import { parallel } from "../utils.js";

export default {
	event: "ready",
	async on({ client }) {
		const {
			data: {
				EU: {
					data: {
						festRecords: { nodes: fests },
					},
				},
			},
		} = await axios.get<FestivalsApiResponse>("https://splatoon3.ink/data/festivals.json", {
			headers: {
				"User-Agent": USER_AGENT,
			},
		});
		const fest = fests.find((v) => v.state !== "CLOSED");
		if (!fest || (await database.isSplatfestEventCreated(fest.title))) return;
		await database.setSplatfestEventCreated(fest.title);
		const guild = await client.guilds.fetch(getEnv("GUILD_ID"));
		await parallel(
			async () => {
				await guild.scheduledEvents.create({
					entityType: GuildScheduledEventEntityType.External,
					name: fest.title,
					privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
					scheduledStartTime: new Date(Date.parse(fest.startTime)),
					scheduledEndTime: new Date(Date.parse(fest.endTime)),
					entityMetadata: { location: "Splatoon 3" },
					image: fest.image.url,
					description: `Automatically created event for the upcoming splatfest.\n<t:${Math.floor(
						new Date(Date.parse(fest.startTime)).getTime() / 1000,
					)}:${TimestampStyles.RelativeTime}>\nData provided by https://splatoon3.ink`,
				});
			},
			async () => {
				const categoryRolePosition = (await guild.roles.fetch(getEnv("SPLATFEST_TEAM_CATEGORY_ROLE_ID")))
					?.position;
				if (!categoryRolePosition) return consola.error("Splatfest team role category role not found");
				for (const [i, team] of Object.entries(fest.teams)) {
					await guild.roles.create({
						name: `⚽・${team.teamName}`,
						color: [team.color.r * 255, team.color.g * 255, team.color.b * 255],
						permissions: [],
						mentionable: false,
						position: +i + categoryRolePosition,
					});
				}
			},
		);
	},
} as Event<"ready">;
