import {
	AudioPlayerStatus,
	createAudioPlayer,
	createAudioResource,
	getVoiceConnection,
	joinVoiceChannel,
} from "@discordjs/voice";
import { getAllAudioBase64 } from "google-tts-api";

import { Readable } from "node:stream";
import getEnv from "../env.js";
import { awaitEvent, parallel } from "../utils.js";
import type Event from "./../event.js";
let lastName: string | undefined = undefined;
const queue: string[] = [];
const SPEAK_REGEX =
	/((https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*))|<:|:\d+>|<id:\w+>|[^A-Za-z\d\s.,!&?;:'"\-()@À-ÿ]/g;

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
			const memberName = message.member.displayName.replace(SPEAK_REGEX, "");
			const memberVoiceChannel = message.member.voice.channel;
			const content = message.cleanContent.replace(SPEAK_REGEX, "");
			if (content === "") return;
			const text = `${lastName !== memberName ? `${memberName} says ` : ""}${content}`;
			queue.push(text);
			if (queue.length > 1) return;
			while (queue[0]) {
				const x = queue[0]!;
				const [player, resource] = await parallel(
					async () => {
						const connection =
							(memberVoiceChannel.id === (await message.guild.members.fetchMe()).voice.channelId &&
								getVoiceConnection(message.guildId)) ||
							joinVoiceChannel({
								channelId: memberVoiceChannel.id,
								guildId: message.guildId,
								adapterCreator: message.channel.guild.voiceAdapterCreator,
							});
						const player = createAudioPlayer();
						connection.subscribe(player);
						return player;
					},
					async () => {
						const tts = Buffer.concat(
							(
								await getAllAudioBase64(x, {
									lang: "en",
								})
							).map((result) => Buffer.from(result.base64, "base64")),
						);
						lastName = memberName;
						const resource = createAudioResource(Readable.from(tts), { inlineVolume: true });
						resource.volume?.setVolume(0.2);
						return resource;
					},
				);
				player.play(resource);
				await awaitEvent(player, AudioPlayerStatus.Idle, 30);
				queue.shift();
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
