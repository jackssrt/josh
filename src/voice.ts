import type { AudioResource } from "@discordjs/voice";
import {
	AudioPlayerStatus,
	createAudioPlayer,
	createAudioResource,
	getVoiceConnection,
	joinVoiceChannel,
} from "@discordjs/voice";
import { inlineCode, type VoiceBasedChannel } from "discord.js";
import { getAllAudioBase64 } from "google-tts-api";
import { Readable } from "node:stream";
import type { LiteralUnion } from "type-fest";
import type Client from "./client.js";
import { reportError } from "./errorhandler.js";
import { Queue } from "./utils/Queue.js";
import Signal from "./utils/Signal.js";
import { awaitEvent } from "./utils/eventEmitter.js";
import { request } from "./utils/http.js";
import { parallel } from "./utils/promise.js";
import { LINK_REGEX } from "./utils/regex.js";
import { chunkify } from "./utils/string.js";

const SPEAK_REGEX = /<a?:|:\d+>|<id:\w+>|^--.*/g;

export function cleanForSpeaking(text: string): string {
	return text.replaceAll(SPEAK_REGEX, "").replace(LINK_REGEX, "").replaceAll("_", " ");
}
const NAME_REGEX = /[^ 'A-Za-z]/g;
export function cleanName(name: string): string {
	return name.replaceAll(NAME_REGEX, "").trim();
}

// No zod schema because we need performance here
type WeilnetApiResponse =
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

type TextToSpeechProvider = {
	/**
	 * Providing a chunkSize will cause textToSpeech to be called multiple times with each chunk as input.
	 */
	chunkSize?: number | undefined;
	textToSpeech: (text: string, voice: string) => Promise<Buffer | Buffer[]>;
};

const weilnetTextToSpeechProvider = {
	chunkSize: 300,
	async textToSpeech(text, voice) {
		const res = (
			await request("https://tiktok-tts.weilnet.workers.dev/api/generation", {
				body: JSON.stringify({
					text,
					voice: voice || "en_us_001",
				}),
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
			})
		).unwrap() as WeilnetApiResponse;
		if (!res.data) throw new Error("no data");
		return Buffer.from(res.data, "base64");
	},
} as TextToSpeechProvider;

const googleTextToSpeechProvider = {
	chunkSize: undefined,
	async textToSpeech(text, voice): Promise<Buffer[]> {
		// reference voice at least once
		voice;
		return (
			await getAllAudioBase64(text, {
				lang: "en",
			})
		).map((result) => Buffer.from(result.base64, "base64"));
	},
} as TextToSpeechProvider;

type CountikApiResponse =
	| {
			status: true;
			v_data: string;
	  }
	| {
			status: "error";
			message: string;
	  };

const countikTextToSpeechProvider = {
	chunkSize: 300,
	async textToSpeech(text, voice) {
		const res = (
			await request("https://countik.com/api/text/speech", {
				body: JSON.stringify({
					text,
					voice: voice || "en_us_001",
				}),
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
			})
		).unwrap() as CountikApiResponse;
		if (res.status !== true) throw new Error("no data");
		return Buffer.from(res.v_data, "base64");
	},
} as TextToSpeechProvider;

const TEXT_TO_SPEECH_PROVIDERS = {
	weilnet: weilnetTextToSpeechProvider,
	google: googleTextToSpeechProvider,
	countik: countikTextToSpeechProvider,
} as const satisfies Record<string, TextToSpeechProvider>;
type TextToSpeechProviderId = keyof typeof TEXT_TO_SPEECH_PROVIDERS;

export async function textToSpeech(
	text: string,
	voice: string,
	providerId: LiteralUnion<TextToSpeechProviderId, string>,
): Promise<Buffer> {
	if (!(providerId in TEXT_TO_SPEECH_PROVIDERS)) throw new Error("unknown text to speech provider");
	const provider = TEXT_TO_SPEECH_PROVIDERS[providerId as TextToSpeechProviderId];
	if (!provider.chunkSize) {
		const buffers = await provider.textToSpeech(text, voice);
		return Array.isArray(buffers) ? Buffer.concat(buffers) : buffers;
	}

	const chunks = chunkify(text, provider.chunkSize);

	// take all of the buffers from all of the chunks and concat them all
	return Buffer.concat((await parallel(chunks.map((chunk) => provider.textToSpeech(chunk, voice)))).flat());
}

type SoundData = {
	resource: AudioResource;
	channel: VoiceBasedChannel;
};

export const queue = new Queue<SoundData>();
const queuePushedToSignal = new Signal();
const player = createAudioPlayer();
function addToQueue(channel: VoiceBasedChannel, data: Buffer) {
	const resource = createAudioResource(Readable.from(data), { inlineVolume: true });
	resource.volume?.setVolume(0.2);
	queue.enqueue({ channel, resource });
	queuePushedToSignal.fire();
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
				await queuePushedToSignal;
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
