import { USER_AGENT } from "@/client.js";
import createSubcommand from "@/commandHandler/subcommand.js";
import { reportSchemaFail } from "@/errorhandler.js";
import * as FestivalsAPI from "@/schemas/festivalsApi.js";
import { request } from "@/utils/http.js";
import { parallel } from "@/utils/promise.js";
import { GuildScheduledEventEntityType, GuildScheduledEventPrivacyLevel, TimestampStyles } from "discord.js";
import { finish } from "../index.js";

export default createSubcommand({
	data: (b) => b.setDescription("Run splatfest"),
	defer: "ephemeral",
	async execute({ client, interaction }) {
		const response = (
			await request("https://splatoon3.ink/data/festivals.json", {
				headers: {
					"User-Agent": USER_AGENT,
				},
			})
		).expect("Failed to fetch splatfests.");
		const validationResult = FestivalsAPI.responseSchema.safeParse(response);
		if (!validationResult.success)
			reportSchemaFail("Festivals", `FestivalsAPI.responseSchema.safeParse(response)`, validationResult.error);
		const data = validationResult.success ? validationResult.data : (response as FestivalsAPI.Response);
		const fest = data.US.data.festRecords.nodes.find((v) => v.state !== "CLOSED");
		if (!fest) return await interaction.editReply("No active splatfest");
		await parallel(
			async () => {
				await client.guild.scheduledEvents.create({
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
				for (const team of fest.teams) {
					await client.guild.roles.create({
						name: `⚽・${team.teamName}`,
						color: [team.color.r * 255, team.color.g * 255, team.color.b * 255],
						permissions: [],
						mentionable: false,
						position: client.splatfestTeamRoleCategory.position,
					});
				}
			},
		);
		await finish(interaction);
	},
});
