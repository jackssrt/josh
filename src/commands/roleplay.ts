import type { APIApplicationCommandOptionChoice, PresenceData, PresenceStatusData } from "discord.js";
import { ActivityType } from "discord.js";
import Client from "../client.js";
import type Command from "../command.js";
import database from "../database.js";
import logger from "../logger.js";

type Subcommand = "presence";

export default {
	data: (b) =>
		b.setDescription("Sets certain roleplay stuff").addSubcommand((b) =>
			b
				.setName("presence")
				.setDescription("Sets the presence")
				.addStringOption((b) =>
					b
						.setName("status")
						.setDescription("The status")
						.setRequired(true)
						.addChoices(
							...(
								["online", "invisible", "idle", "dnd"] as const satisfies readonly PresenceStatusData[]
							).map<APIApplicationCommandOptionChoice<string>>((v) => ({ name: v, value: v })),
						),
				)
				.addNumberOption((b) =>
					b
						.setName("activitytype")
						.setDescription("The type of the activity")
						.setRequired(false)
						.addChoices(
							...(
								[0, 1, 2, 3, 5] as const satisfies readonly Exclude<ActivityType, ActivityType.Custom>[]
							).map<APIApplicationCommandOptionChoice<number>>((v) => ({
								name: `${ActivityType[v]}`,
								value: v,
							})),
						),
				)
				.addStringOption((b) =>
					b.setName("activityname").setDescription("The name of the activity").setRequired(false),
				)
				.addStringOption((b) =>
					b.setName("activityurl").setDescription("The url of the activity").setRequired(false),
				),
		),
	userAllowList: process.env.ROLEPLAYER_IDS.split(","),
	async execute({ client, interaction }) {
		const subcommand = interaction.options.getSubcommand(true) as Subcommand;
		if (subcommand === "presence") {
			const status = interaction.options.getString("status", true) as PresenceStatusData;
			const activityType = interaction.options.getNumber("activitytype", false) as Exclude<
				ActivityType,
				ActivityType.Custom
			>;
			const activityName = interaction.options.getString("activityname", false);
			if (!activityName && activityType === undefined) {
				client.user.setPresence({ status, activities: Client.defaultPresence.activities });
				await database.setActivePresence({ status, activities: Client.defaultPresence.activities });
				await interaction.reply({ content: "✅", ephemeral: true });
			}
			if (!activityName || activityType === undefined) {
				logger.debug(activityName, activityType);
				return await interaction.reply({ content: "Provide an activity type and name!", ephemeral: true });
			}
			const activityUrl = interaction.options.getString("activityurl", false);
			const presenceData: PresenceData = {
				status,
				activities: [
					{
						type: activityType,
						name: activityName,
						...(activityUrl ? { url: activityUrl ?? undefined } : {}),
					},
				],
			};

			client.user.setPresence(presenceData);
			await database.setActivePresence(presenceData);
			await interaction.reply({ content: "✅", ephemeral: true });
		}
	},
} as Command;
