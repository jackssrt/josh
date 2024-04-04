import createSubcommand from "@/commandHandler/subcommand.js";
import database from "@/database.js";
import { queueSound, textToSpeech } from "@/voice.js";
import { ChannelType } from "discord.js";
import { request } from "undici";

export default createSubcommand({
	data: (b) =>
		b
			.setName("tts")
			.setDescription("Says something in voice chat")
			.addStringOption((b) =>
				b.setName("text").setDescription("The text to say").setRequired(false).setMinLength(1),
			)
			.addAttachmentOption((b) =>
				b.setName("attachment").setDescription("The attachment to say").setRequired(false),
			)
			.addChannelOption((b) => b.setName("channel").setDescription("The channel to say it in").setRequired(false))
			.addStringOption((b) => b.setName("voice").setDescription("The voice to use").setRequired(false)),
	defer: "ephemeral",
	async execute({ client, interaction }) {
		const channel =
			interaction.options.getChannel("channel", false, [ChannelType.GuildVoice, ChannelType.GuildStageVoice]) ??
			client.guildMe.voice.channel;
		if (!channel) return await interaction.editReply("I'm not in a channel and you didn't provide one!");
		const attachment = interaction.options.getAttachment("attachment", false);
		if (attachment) {
			const audio = Buffer.from(await (await request(attachment.url)).body.arrayBuffer());

			queueSound(client, channel, audio);
		} else {
			const text = interaction.options.getString("text", false);
			if (!text) return await interaction.editReply("You didn't provide text to say or an attachment!");
			const voice = interaction.options.getString("voice", false);

			const sound = await textToSpeech(text, voice ?? (await database.getFlag("tts.voice")));
			queueSound(client, channel, sound);
		}
		await interaction.editReply("✅");
	},
});
