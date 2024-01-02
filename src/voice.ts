import type { AudioResource } from "@discordjs/voice";
import {
	AudioPlayerStatus,
	createAudioPlayer,
	createAudioResource,
	getVoiceConnection,
	joinVoiceChannel,
} from "@discordjs/voice";
import { inlineCode, type VoiceBasedChannel } from "discord.js";
import { EventEmitter } from "events";
import { getAllAudioBase64 } from "google-tts-api";
import { Readable } from "stream";
import type Client from "./client.js";
import { LINK_REGEX, Queue, awaitEvent, parallel, reportError, request } from "./utils.js";

const SPEAK_REGEX = /<a?:|:\d+>|<id:\w+>|^--.*/g;

export function cleanForSpeaking(text: string): string {
	return text.replace(SPEAK_REGEX, "").replace(LINK_REGEX, "").replace(/_/g, " ");
}
const NAME_REGEX = /[^a-zA-Z ']/g;
export function cleanName(name: string): string {
	return name.replace(NAME_REGEX, "").trim();
}

// No zod schema because we need performance here
type TiktokApiResponse =
	| {
			success: true;
			data: string;
			error: null;
	  }
	| {
			success: false;
			data: null;
			error: string;
	  };

export async function textToSpeech(text: string, voice: string) {
	const subVoice = voice.split("-")[1];
	return Buffer.concat(
		voice.startsWith("tiktok")
			? await parallel(
					text.match(/.{1,300}/g)?.map(async (subtext) =>
						Buffer.from(
							(
								(
									await request("https://tiktok-tts.weilnet.workers.dev/api/generation", {
										body: JSON.stringify({
											text: subtext,
											voice: subVoice ?? "en_us_001",
										}),
										method: "POST",
									})
								).unwrap() as TiktokApiResponse
							).data ??
								(() => {
									throw new Error("no data");
								})(),

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

type SoundData = {
	resource: AudioResource;
	channel: VoiceBasedChannel;
};

export const queue = new Queue<SoundData>();
const queuePushedToEventEmitter = new EventEmitter();
const player = createAudioPlayer();
function addToQueue(channel: VoiceBasedChannel, data: Buffer) {
	const resource = createAudioResource(Readable.from(data), { inlineVolume: true });
	resource.volume?.setVolume(0.2);
	queue.enqueue({ channel, resource });
	queuePushedToEventEmitter.emit("event");
}

let workerSpawned = false;
function spawnWorker(client: Client<true>) {
	if (workerSpawned) return;
	workerSpawned = true;
	void (async () => {
		while (true) {
			const currentSound = queue.dequeue();
			if (!currentSound) {
				// wait for new sound to be available to play
				await awaitEvent(queuePushedToEventEmitter, "event");
				continue;
			}
			try {
				// join the channel
				// debounce
				const existingConnection =
					currentSound.channel === client.guildMe.voice.channel && getVoiceConnection(client.guild.id);
				const connection =
					existingConnection ||
					joinVoiceChannel({
						channelId: currentSound.channel.id,
						guildId: currentSound.channel.guild.id,
						adapterCreator: currentSound.channel.guild.voiceAdapterCreator,
						selfDeaf: false,
					});
				if (!existingConnection) connection.subscribe(player);

				// play the sound
				player.play(currentSound.resource);
				await awaitEvent(player, AudioPlayerStatus.Idle, 30);
			} catch (error) {
				reportError({
					title: "Voice worker error",
					description: `The worker spawned by ${inlineCode("queueSound()")} threw an error.`,
					error: error as Error,
				});
			}
		}
	})();
}

export function queueSound(client: Client<true>, channel: VoiceBasedChannel, sound: Buffer) {
	addToQueue(channel, sound);
	spawnWorker(client);
}
