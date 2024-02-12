import Client from "@/client.js";
import createSubcommand from "@/commandHandler/subcommand.js";
import database from "@/database.js";
import {
	ActivityType,
	type APIApplicationCommandOptionChoice,
	type PresenceData,
	type PresenceStatusData,
} from "discord.js";

export default createSubcommand({
	data: (b) =>
		b
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
						...([0, 1, 2, 3, 4, 5] as const satisfies readonly ActivityType[]).map<
							APIApplicationCommandOptionChoice<number>
						>((v) => ({
							name: `${ActivityType[v]}`,
							value: v,
						})),
					),
			)
			.addStringOption((b) =>
				b.setName("activityname").setDescription("The name of the activity").setRequired(false),
			)
			.addStringOption((b) =>
				b.setName("activitystate").setDescription("The state of the activity").setRequired(false),
			)
			.addStringOption((b) =>
				b.setName("activityurl").setDescription("The url of the activity").setRequired(false),
			),
	defer: "ephemeral",
	async execute({ client, interaction }) {
		const status = interaction.options.getString("status", true) as PresenceStatusData;
		const activityType = interaction.options.getNumber("activitytype", false) as ActivityType | null;
		const activityName = interaction.options.getString("activityname", false);
		const activityState = interaction.options.getString("activitystate", false);
		const activityUrl = interaction.options.getString("activityurl", false);
		if (!activityName && activityType === null && !activityState && !activityUrl) {
			client.user.setPresence({ status, activities: Client.defaultPresence.activities });
			await database.setActivePresence({ status, activities: Client.defaultPresence.activities });
			await interaction.editReply("✅");
			return;
		}
		if (!activityName || activityType === null)
			return await interaction.editReply("Provide an activity type and name!");
		const presenceData: PresenceData = {
			status,
			activities: [
				{
					type: activityType,
					name: activityName,
					...(activityState ? { state: activityState } : {}),
					...(activityUrl ? { url: activityUrl } : {}),
				},
			],
		};

		client.user.setPresence(presenceData);
		await database.setActivePresence(presenceData);
		await interaction.editReply("✅");
	},
});
