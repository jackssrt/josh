import type { Guild } from "discord.js";
import { GuildScheduledEventEntityType, GuildScheduledEventPrivacyLevel } from "discord.js";
import database from "../database.js";
import { EMPTY_EMOJI, SUB_EMOJI } from "../emojis.js";
import rotations from "../rotations/index.js";
import { dedent, truncate } from "../utils.js";
import createEvent from "./../event.js";

export async function makeChallengeEvents(guild: Guild, overrideDatabase = false) {
	await Promise.all(
		rotations.challenges.periods.map(async (challenge) => {
			if (challenge === undefined) return;
			// ~~ is a faster version of Math.floor()
			const id = `${challenge.id}-${~~(challenge.startTime.getTime() / 1000)}`;
			if (!(await database.shouldMakeChallengeEvent(id)) && !overrideDatabase) return;
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
				image: await (await challenge.images(600, 180, "challengesEvent"))[0].toBuffer(),
				description: truncate(
					1000,
					dedent`**Time Periods**
							${challenge.timePeriods.periods
								.map((v) =>
									v
										.short()
										.map((v) => v.join(" "))
										.join("\n"),
								)
								.join("\n")}

							**Game Mode**
							${challenge.rule.emoji} ${challenge.rule.name}
							${EMPTY_EMOJI}${SUB_EMOJI}${challenge.stages.map((v) => v.name).join(", ")}

							**Description**
							${challenge.longDescription}`,
				),
			});
			await database.setMadeChallengeEvent(id);
		}),
	);
}

export default createEvent({
	event: "ready",
	on({ client }) {
		rotations.hook(async () => {
			await makeChallengeEvents(client.guild);
		});
	},
});
