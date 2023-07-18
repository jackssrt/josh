import axios from "axios";
import type { Snowflake } from "discord.js";
import { Collection } from "discord.js";
import database from "../database.js";
import { errorEmbeds, parallel, pawait } from "../utils.js";
import { cleanForSpeaking, queueSound, textToSpeech } from "../voice.js";
import type Event from "./../event.js";
const lastNames = new Collection<Snowflake, string>();

export default [
	{
		event: "messageCreate",
		async on({ client }, message) {
			if (
				message.channelId !== process.env.TTS_CHANNEL_ID ||
				message.author.bot ||
				!message.inGuild() ||
				!message.member?.voice.channel ||
				!(await database.getBooleanFeatureFlag("tts.enabled")) ||
				((await database.getBooleanFeatureFlag("tts.mutedOnly")) && !message.member.voice.mute)
			)
				return;
			const filesToPlay = message.attachments.filter(
				(v) => !!v.contentType && (v.contentType.startsWith("video") || v.contentType.startsWith("audio")),
			);
			const memberVoiceChannel = message.member.voice.channel;
			const [data, error] = await pawait(
				parallel(
					async () => {
						const memberName = cleanForSpeaking(message.member!.displayName);
						const content = cleanForSpeaking(message.cleanContent);
						if (content === "") return;
						const text = `${
							lastNames.get(memberVoiceChannel.id) !== memberName ? `${memberName} says ` : ""
						}${content}`;
						lastNames.set(memberVoiceChannel.id, memberName);
						const sound = await textToSpeech(text);

						return sound;
					},
					...(filesToPlay.size > 0 && (await database.getBooleanFeatureFlag("tts.playFiles"))
						? filesToPlay.map(async (v) =>
								Buffer.from(
									(await axios.get<ArrayBuffer>(v.url, { responseType: "arraybuffer" })).data,
								),
						  )
						: []),
				),
			);
			if (error)
				await parallel(
					message.react("❌"),
					client.owner.send(
						await errorEmbeds({
							title: "TTS error",
							description: `${error.name} ${error.message}\n${error.stack ?? "no stack"}`,
						}),
					),
				);
			data?.forEach((v) => v && queueSound(client, memberVoiceChannel, v));
		},
	} as Event<"messageCreate">,
];
