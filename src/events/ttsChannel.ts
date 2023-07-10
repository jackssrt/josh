import {
	AudioPlayerStatus,
	createAudioPlayer,
	createAudioResource,
	getVoiceConnection,
	joinVoiceChannel,
} from "@discordjs/voice";
import { getAllAudioBase64 } from "google-tts-api";

import axios from "axios";
import type { Snowflake } from "discord.js";
import { Collection } from "discord.js";
import { Readable } from "node:stream";
import database from "../database.js";
import { LINK_REGEX, awaitEvent, errorEmbeds, parallel, pawait } from "../utils.js";
import type Event from "./../event.js";
const lastNames = new Collection<Snowflake, string>();
const queue: Buffer[] = [];
const SPEAK_REGEX = /<a?:|:\d+>|<id:\w+>|^--.*/g;

export function clean(text: string): string {
	return text.replace(SPEAK_REGEX, "").replace(LINK_REGEX, "").replace("_", " ");
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

			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const [_, error] = await pawait(
				(async () => {
					if (filesToPlay.size > 0) {
						queue.push(
							...(await parallel(
								filesToPlay.map(async (v) =>
									Buffer.from(
										(
											await axios.get<ArrayBuffer>(v.url, { responseType: "arraybuffer" })
										).data,
									),
								),
							)),
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

						queue.push(sound);
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
			if (queue.length > 1) return;
			while (queue[0]) {
				const x = queue[0]!;
				try {
					const connection =
						(memberVoiceChannel.id === (await message.guild.members.fetchMe()).voice.channelId &&
							getVoiceConnection(message.guildId)) ||
						joinVoiceChannel({
							channelId: memberVoiceChannel.id,
							guildId: message.guildId,
							adapterCreator: message.channel.guild.voiceAdapterCreator,
							selfDeaf: false,
						});
					const player = createAudioPlayer();
					connection.subscribe(player);
					const resource = createAudioResource(Readable.from(x), { inlineVolume: true });
					resource.volume?.setVolume(0.2);
					player.play(resource);
					await awaitEvent(player, AudioPlayerStatus.Idle, 30);
				} finally {
					queue.shift();
				}
			}
		},
	} as Event<"messageCreate">,
	{
		event: "voiceStateUpdate",
		async on(_, oldState) {
			const { voice } = await oldState.guild.members.fetchMe();
			if (oldState.channel?.id === voice.channel?.id && voice.channel?.members.size === 1)
				await voice.disconnect();
		},
	} as Event<"voiceStateUpdate">,
];
