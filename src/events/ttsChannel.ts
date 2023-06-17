import {
	AudioPlayerStatus,
	createAudioPlayer,
	createAudioResource,
	getVoiceConnection,
	joinVoiceChannel,
} from "@discordjs/voice";
import { getAllAudioBase64 } from "google-tts-api";

import axios from "axios";
import { Readable } from "node:stream";
import database from "../database.js";
import getEnv from "../env.js";
import { LINK_REGEX, awaitEvent, parallel } from "../utils.js";
import type Event from "./../event.js";
let lastName: string | undefined = undefined;
const queue: string[] = [];
const SPEAK_REGEX = /<a?:|:\d+>|<id:\w+>|^--.*/g;

export function clean(text: string): string {
	return text.replace(SPEAK_REGEX, "").replace(LINK_REGEX, "").replace("_", " ");
}
async function getSound(text: string) {
	const voice = await database.getFeatureFlag("tts.voice");
	return Buffer.concat(
		voice === "tiktok"
			? await parallel(
					text.match(/.{1,300}/g)?.map(async (subtext) =>
						Buffer.from(
							(
								await axios.post<{ data: string }>(
									"https://tiktok-tts.weilnet.workers.dev/api/generation",
									{
										text: subtext,
										voice: "en_us_001",
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
		async on(_, message) {
			if (
				message.channelId !== getEnv("TTS_CHANNEL_ID") ||
				message.author.bot ||
				!message.inGuild() ||
				!message.member?.voice.channel
			)
				return;
			const memberName = clean(message.member.displayName);
			const memberVoiceChannel = message.member.voice.channel;
			const content = clean(message.cleanContent);
			if (content === "") return;
			const text = `${lastName !== memberName ? `${memberName} says ` : ""}${content}`;
			queue.push(text);
			if (queue.length > 1) return;
			while (queue[0]) {
				const x = queue[0]!;
				try {
					const [player, resource] = await parallel(
						async () => {
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
							return player;
						},
						async () => {
							const tts = await getSound(x);
							lastName = memberName;
							const resource = createAudioResource(Readable.from(tts), { inlineVolume: true });
							resource.volume?.setVolume(0.2);
							return resource;
						},
					);
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
