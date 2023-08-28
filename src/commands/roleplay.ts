import type { APIApplicationCommandOptionChoice, PresenceData, PresenceStatusData } from "discord.js";
import { ActivityType, ChannelType } from "discord.js";
import Client from "../client.js";
import database from "../database.js";
import { queueSound, textToSpeech } from "../voice.js";
import createCommand from "./../command.js";

type Subcommand = "tts" | "presence";

export default createCommand({
	data: (b) =>
		b
			.setDescription("Sets certain roleplay stuff")
			.addSubcommand((b) =>
				b
					.setName("tts")
					.setDescription("Says something in voice chat")
					.addStringOption((b) =>
						b.setName("text").setDescription("The text to say").setRequired(true).setMinLength(1),
					)
					.addChannelOption((b) =>
						b.setName("channel").setDescription("The channel to say it in").setRequired(false),
					)
					.addStringOption((b) => b.setName("voice").setDescription("The voice to use").setRequired(false)),
			)
			.addSubcommand((b) =>
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
									[
										"online",
										"invisible",
										"idle",
										"dnd",
									] as const satisfies readonly PresenceStatusData[]
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
			),
	userAllowList: process.env.ROLEPLAYER_IDS.split(","),
	defer: "ephemeral",
	async execute({ client, interaction }) {
		const subcommand = interaction.options.getSubcommand(true) as Subcommand;
		if (subcommand === "tts") {
			const channel =
				interaction.options.getChannel("channel", false, [
					ChannelType.GuildVoice,
					ChannelType.GuildStageVoice,
				]) ?? client.guildMe.voice.channel;
			if (!channel) return await interaction.editReply("I'm not in a channel and you didn't provide one!");
			const text = interaction.options.getString("text", true);
			const voice = interaction.options.getString("voice", false);

			const sound = await textToSpeech(text, voice ?? (await database.getFlag("tts.voice")));
			queueSound(client, channel, sound);
			await interaction.editReply("✅");
		} else if (subcommand === "presence") {
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
		}
	},
});
