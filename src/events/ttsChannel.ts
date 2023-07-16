import { getAllAudioBase64 } from "google-tts-api";

import axios from "axios";
import type { Snowflake } from "discord.js";
import { Collection } from "discord.js";
import database from "../database.js";
import { LINK_REGEX, errorEmbeds, parallel, pawait } from "../utils.js";
import { queueSound } from "../voice.js";
import type Event from "./../event.js";
const lastNames = new Collection<Snowflake, string>();
const SPEAK_REGEX = /<a?:|:\d+>|<id:\w+>|^--.*/g;

export function clean(text: string): string {
	return text.replace(SPEAK_REGEX, "").replace(LINK_REGEX, "").replace(/_/g, " ");
}
async function getSound(text: string) {
	const voice = await database.getFeatureFlag("tts.voice");
	const subVoice = voice.split("-")[1];
	return Buffer.concat(
		voice.startsWith("tiktok")
			? await parallel(
					text.match(/.{1,300}/g)?.map(async (subtext) =>
						Buffer.from(
							(
								await axios.post<{ data: string }>(
									"https://tiktok-tts.weilnet.workers.dev/api/generation",
									{
										text: subtext,
										voice: subVoice ?? "en_us_001",
									},
								)
							).data.data,
							"base64",
						),
					) ?? [],
			  )
			: (
					await getAllAudioBase64(text, {
						lang: "en",
					})
			  ).map((result) => Buffer.from(result.base64, "base64")),
	);
}

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
				(async () => {
					if (filesToPlay.size > 0) {
						return await parallel(
							filesToPlay.map(async (v) =>
								Buffer.from(
									(await axios.get<ArrayBuffer>(v.url, { responseType: "arraybuffer" })).data,
								),
							),
						);
					} else {
						const memberName = clean(message.member!.displayName);
						const content = clean(message.cleanContent);
						if (content === "") return;
						const text = `${
							lastNames.get(memberVoiceChannel.id) !== memberName ? `${memberName} says ` : ""
						}${content}`;
						lastNames.set(memberVoiceChannel.id, memberName);
						const sound = await getSound(text);

						return sound;
					}
				})(),
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
			if (!data) return;
			(Array.isArray(data) ? data : [data]).forEach((v) => queueSound(client, memberVoiceChannel, v));
		},
	} as Event<"messageCreate">,
];
