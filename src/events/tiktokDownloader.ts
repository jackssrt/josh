import type { ChildProcessWithoutNullStreams } from "child_process";
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { inlineCode, type Message } from "discord.js";
import ffmpegPath from "ffmpeg-static";
import { unlink } from "fs/promises";
import { createInterface } from "readline";
import type Client from "../client.js";
import database from "../database.js";
import { SQUID_SHUFFLE_EMOJI } from "../emojis.js";
import createEvent from "../event.js";
import logger from "../logger.js";
import {
	awaitEvent,
	canReplaceMessage,
	embeds,
	messageHiddenText,
	parallelSettled,
	pawait,
	replaceMessage,
	reportError,
} from "../utils.js";

function extractFFmpegRatio(ffmpegOutput: string, totalDurationInSeconds: number) {
	const timeString = ffmpegOutput.match(/(?<=time=)([^ ]+)/g)?.[0];
	const [hours, minutes, seconds] = (timeString ?? "0").split(":").map(parseFloat);
	if (hours === undefined || minutes === undefined || seconds === undefined) return;
	const totalTimeInSeconds = hours * 3600 + minutes * 60 + seconds;
	// +1 to account for decimals, ytdlp doesn't provide decimal duration only whole seconds.
	// also doesn't really matter since even if it finishes at 91%. It sets the user's expectation lower :D
	return totalTimeInSeconds / (totalDurationInSeconds + 1);
}
function extractYtdlpInfo(ytdlpOutput: string) {
	const data = ytdlpOutput.match(/^(\d+),(\d+),(\d+)$/gm)?.[0];
	if (!data) return;
	const [downloadedBytes, totalBytes, durationSeconds] = data.split(",") as [string, string, string];
	return [parseFloat(downloadedBytes) / parseFloat(totalBytes), parseFloat(durationSeconds)] as const;
}

const tiktokUrlRegex = /https?:\/\/(www\.)?(vm\.tiktok\.com|(m\.)?tiktok\.com)\/(((@[^/]+\/video|v)\/([^/]+))|\S+)/g;
export async function downloadTiktokVideos(client: Client<true>, message: Message) {
	const tiktokLink = message.content.match(tiktokUrlRegex)?.[0]?.replace(/\?.*/g, "");

	if (!tiktokLink || !message.member || !canReplaceMessage(message)) return;
	const content = message.content.replace(tiktokUrlRegex, "<$&>");
	const [resultMessage, webhook] = await replaceMessage(client, message, {
		...(await embeds((b) => b.setTitle(`${SQUID_SHUFFLE_EMOJI} Downloading tiktok video`))),
		content,
	});
	let ytDlpRatio: number | undefined = undefined;
	let ffmpegRatio: number | undefined = undefined;
	let totalDurationInSeconds: number | undefined = undefined;

	// download using yt-dlp
	const ytDlpProcess = spawn("yt-dlp", [
		tiktokLink,
		"-f",
		"mp4",
		"--progress-template",
		"download:%(progress.downloaded_bytes)s,%(progress.total_bytes)s,%(info.duration)s",
		"-o",
		"-",
	]);
	const ytDlpRl = createInterface({ input: ytDlpProcess.stderr });
	ytDlpRl.on("line", (line) => {
		try {
			[ytDlpRatio, totalDurationInSeconds] = extractYtdlpInfo(line) ?? [ytDlpRatio, totalDurationInSeconds];
		} catch (e) {
			logger.error("ytdlp error in tiktokDownloader", e);
		}
	});
	const id = randomUUID();

	// re-encode video for discord embed
	const ffmpegProcess = spawn(ffmpegPath ?? "ffmpeg", ["-i", "-", `./temp/${id}.mp4`]);
	ytDlpProcess.stdout.pipe(ffmpegProcess.stdin);
	const ffmpegRl = createInterface({ input: ffmpegProcess.stderr });
	ffmpegRl.on("line", (line) => {
		try {
			if (totalDurationInSeconds !== undefined)
				ffmpegRatio = extractFFmpegRatio(line, totalDurationInSeconds) ?? ffmpegRatio;
		} catch (e) {
			logger.error("ffmpeg error in tiktokDownloader", e);
		}
	});

	const progressInterval = setInterval(() => {
		// update progress
		void (async () => {
			await webhook.editMessage(resultMessage, {
				...(await embeds((b) =>
					b.setTitle(`${SQUID_SHUFFLE_EMOJI} Downloading tiktok video`).addFields(
						(
							[
								["Download", ytDlpRatio ?? 0],
								["Re-encode", ffmpegRatio ?? 0],
								["Average", ((ytDlpRatio ?? 0) + (ffmpegRatio ?? 0)) / 2],
							] as const
						).map(([label, ratio]) => ({
							name: label,
							value: `${inlineCode(`${Math.round(ratio * 100).toString()}%`)}`,
							inline: true,
						})),
					),
				)),
			});
		})();
	}, 1_500);

	// due to how ChildProcessWithoutNullStreams's on function is defined (function overloads)
	// the EventNames<T extends EventEmitter> doesn't work
	// so I'm manually overriding it to be a string
	await awaitEvent<ChildProcessWithoutNullStreams, string>(ffmpegProcess, "exit"); // wait for re-encode to finish
	clearInterval(progressInterval);
	// get cdn link
	void webhook.editMessage(resultMessage, {
		...(await embeds((b) =>
			b.setTitle(`${SQUID_SHUFFLE_EMOJI} Downloading tiktok video...`).setDescription("Uploading to discord..."),
		)),
		content,
	});
	const altMessageResult = await pawait(
		client.alt.send({
			files: [`./temp/${id}.mp4`],
		}),
	);
	if (altMessageResult.isErr()) {
		reportError({
			title: "Tiktok video discord upload failed",
			affectedUser: message.member,
			error: altMessageResult.error,
		});
		await webhook.editMessage(resultMessage, {
			...(await embeds((b) => b.setTitle(`Tiktok video download failed :(`).setColor("Red"))),
			content,
		});
		return;
	}
	const discordLink = altMessageResult.value.attachments.first()?.url;
	if (!discordLink) {
		logger.error("no discord link");
		return;
	}

	// clean up and finalize
	await parallelSettled([
		message.delete(),
		unlink(`./temp/${id}.mp4`),
		webhook.editMessage(resultMessage, {
			content: `${message.content.replace(tiktokUrlRegex, "<$&>")}${messageHiddenText(discordLink)}`,
			embeds: [],
		}),
	]);
}

export default createEvent({
	event: "messageCreate",
	async on({ client }, message) {
		if (
			message.guild !== client.guild ||
			!(await database.getBooleanFlag("message.tiktokDownloader.enabled")) ||
			message.author.bot
		)
			return;
		await downloadTiktokVideos(client, message);
	},
});
