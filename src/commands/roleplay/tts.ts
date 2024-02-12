import createSubcommand from "@/commandHandler/subcommand.js";
import database from "@/database.js";
import { queueSound, textToSpeech } from "@/voice.js";
import { ChannelType } from "discord.js";

export default createSubcommand({
	data: (b) =>
		b
			.setName("tts")
			.setDescription("Says something in voice chat")
			.addStringOption((b) =>
				b.setName("text").setDescription("The text to say").setRequired(true).setMinLength(1),
			)
			.addChannelOption((b) => b.setName("channel").setDescription("The channel to say it in").setRequired(false))
			.addStringOption((b) => b.setName("voice").setDescription("The voice to use").setRequired(false)),
	defer: "ephemeral",
	async execute({ client, interaction }) {
		const channel =
			interaction.options.getChannel("channel", false, [ChannelType.GuildVoice, ChannelType.GuildStageVoice]) ??
			client.guildMe.voice.channel;
		if (!channel) return await interaction.editReply("I'm not in a channel and you didn't provide one!");
		const text = interaction.options.getString("text", true);
		const voice = interaction.options.getString("voice", false);

		const sound = await textToSpeech(text, voice ?? (await database.getFlag("tts.voice")));
		queueSound(client, channel, sound);
		await interaction.editReply("✅");
	},
});
