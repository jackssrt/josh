import type { Guild } from "discord.js";
import { GuildScheduledEventEntityType, GuildScheduledEventPrivacyLevel } from "discord.js";
import database from "../database.js";
import { CHALLENGES_EMOJI, EMPTY_EMOJI, SUB_EMOJI } from "../emojis.js";
import getEnv from "../env.js";
import type Event from "../event.js";
import rotations from "../rotations/index.js";
import { dedent } from "../utils.js";

export async function makeChallengeEvents(guild: Guild, overrideDatabase = false) {
	await Promise.all(
		rotations.challenges.ranges.map(async (challenge) => {
			if (challenge === undefined) return;
			if (!(await database.shouldMakeChallengeEvent(challenge.id)) && !overrideDatabase) return;
			await guild.scheduledEvents.create({
				entityType: GuildScheduledEventEntityType.External,
				entityMetadata: {
					location: challenge.stages.map((v) => v.name).join(", "),
				},
				name: challenge.challengeName.toLowerCase().includes("challenge")
					? challenge.challengeName
					: `${challenge.challengeName} (Challenge)`,
				privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
				scheduledStartTime:
					challenge.startTime > new Date() ? challenge.startTime : new Date(new Date().getTime() + 60 * 1000),
				scheduledEndTime: challenge.endTime,
				image: await (await challenge.images(600, 180, false))[0].toBuffer(),
				description: dedent`**Time Periods**
									${challenge.timePeriods.ranges.map((v) => v.short()).join("\n")}
									
									**Game Mode**
									${challenge.rule.emoji} ${challenge.rule.name}
									${EMPTY_EMOJI}${SUB_EMOJI}${challenge.stages.map((v) => v.name).join(", ")}

									**Description**
									${challenge.longDescription}
									
									${CHALLENGES_EMOJI} Data provided by splatoon3.ink`,
			});
			await database.setMadeChallengeEvent(challenge.id);
		}),
	);
}

export default {
	event: "ready",
	async on({ client }) {
		const guild = await client.guilds.fetch(getEnv("GUILD_ID"));
		rotations.hook(async () => {
			await makeChallengeEvents(guild);
		});
	},
} as Event<"ready">;
