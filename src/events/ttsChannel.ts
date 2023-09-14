import axios from "axios";
import type { Message, Snowflake, VoiceBasedChannel } from "discord.js";
import { Collection } from "discord.js";
import type Client from "../client.js";
import database from "../database.js";
import { parallel, pawait } from "../utils.js";
import { cleanForSpeaking, cleanName, queueSound, textToSpeech } from "../voice.js";
import createEvent from "./../event.js";
const lastNames = new Collection<Snowflake, string>();

async function queueTextToSpeechInChannel(client: Client<true>, channel: VoiceBasedChannel, message: Message<true>) {
	const memberName = cleanName(cleanForSpeaking(message.member!.displayName));
	const content = cleanForSpeaking(message.cleanContent);
	if (content === "") return;

	const text = `${lastNames.get(channel.id) !== memberName ? `${memberName} says ` : ""}${content}`.toLowerCase();

	lastNames.set(channel.id, memberName);

	const sound = await textToSpeech(text, await database.getFlag("tts.voice"));
	queueSound(client, channel, sound);
}

export default createEvent({
	event: "messageCreate",
	async on({ client }, message) {
		if (
			message.channelId !== process.env.TTS_CHANNEL_ID ||
			message.author.bot ||
			!message.inGuild() ||
			!message.member ||
			!(await database.getBooleanFlag("tts.enabled")) ||
			!(!(await database.getBooleanFlag("tts.channelLock")) || message.member.voice.channel) ||
			((await database.getBooleanFlag("tts.mutedOnly")) && !message.member.voice.mute)
		)
			return;
		const filesToPlay = message.attachments.filter(
			(v) => !!v.contentType && (v.contentType.startsWith("video") || v.contentType.startsWith("audio")),
		);
		const memberVoiceChannel = message.member?.voice.channel;
		const channels = memberVoiceChannel
			? new Collection([[memberVoiceChannel.id, memberVoiceChannel]])
			: client.voiceCategory.children.cache.filter((v) => v.isVoiceBased());
		const result = await pawait(
			parallel(
				async () => {
					const memberVoiceChannel = message.member?.voice.channel;

					if (memberVoiceChannel) {
						await queueTextToSpeechInChannel(client, memberVoiceChannel, message);
					} else {
						await parallel(
							...channels.map(async (v) => {
								if (v.isVoiceBased() && v.members.filter((v) => !v.user.bot).size > 0)
									await queueTextToSpeechInChannel(client, v, message);
							}),
						);
					}
				},
				...(filesToPlay.size > 0 && (await database.getBooleanFlag("tts.playFiles"))
					? filesToPlay.map(async (v) => {
							const audio = Buffer.from(
								(await axios.get<ArrayBuffer>(v.url, { responseType: "arraybuffer" })).data,
							);
							if (memberVoiceChannel) {
								queueSound(client, memberVoiceChannel, audio);
							} else {
								channels.forEach((v) => {
									if (v.isVoiceBased() && v.members.filter((v) => !v.user.bot).size > 0)
										queueSound(client, v, audio);
								});
							}
					  })
					: []),
			),
		);
		if (result[1]) await message.react("❌");
	},
});
