import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import { randomUUID } from "crypto";
import { AttachmentBuilder, inlineCode, type ChatInputCommandInteraction } from "discord.js";
import ffmpegPath from "ffmpeg-static";
import { createReadStream } from "fs";
import { unlink } from "fs/promises";
import { createInterface } from "readline";
import createCommand from "../commandHandler/command.js";
import { SQUID_SHUFFLE_EMOJI } from "../emojis.js";
import logger from "../utils/Logger.js";
import { embeds } from "../utils/discord/embeds.js";
import { awaitEvent } from "../utils/eventEmitter.js";

function extractFFmpegRatio(ffmpegOutput: string, totalDurationInSeconds: number) {
	const timeString = ffmpegOutput.match(/(?<=time=)([^ ]+)/g)?.[0];
	const [hours, minutes, seconds] = (timeString ?? "0").split(":").map(parseFloat);
	if (hours === undefined || minutes === undefined || seconds === undefined) return;
	const totalTimeInSeconds = hours * 3600 + minutes * 60 + seconds;
	// +1 to account for decimals, ytdlp doesn't provide decimal duration only whole seconds.
	// also doesn't really matter since even if it finishes before 100%. It sets the user's expectation lower :D
	return totalTimeInSeconds / (totalDurationInSeconds + 1);
}

function extractYtdlpInfo(ytdlpOutput: string) {
	const data = ytdlpOutput.match(/^(\d+),(\d+),(\d+)$/gm)?.[0];
	if (!data) return;
	const [downloadedBytes, totalBytes, durationSeconds] = data.split(",") as [string, string, string];
	return [parseFloat(downloadedBytes) / parseFloat(totalBytes), parseFloat(durationSeconds)] as const;
}

const TIKTOK_REGEX = /https?:\/\/(www\.)?(vm\.tiktok\.com|(m\.)?tiktok\.com)\/(((@[^/]+\/video|v)\/([^/]+))|\S+)/g;
export async function downloadTiktokVideo(interaction: ChatInputCommandInteraction) {
	const tiktokLink = interaction.options.getString("url", true).match(TIKTOK_REGEX)?.[0]?.replace(/\?.*/g, "");

	if (!tiktokLink) return await interaction.reply({ content: "Invalid link!", ephemeral: true });
	await interaction.deferReply();
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
	// typescript import this properly
	const ffmpegProcess = spawn((ffmpegPath as unknown as string | null) ?? "ffmpeg", ["-i", "-", `./temp/${id}.mp4`]);
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
			await interaction.editReply({
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
							value: inlineCode(`${Math.round(ratio * 100).toString()}%`),
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

	// clean up and finalize
	try {
		await interaction.editReply({
			embeds: [],
			files: [new AttachmentBuilder(createReadStream(`./temp/${id}.mp4`))],
		});
	} finally {
		await unlink(`./temp/${id}.mp4`);
	}
}

export default createCommand({
	data: (b) =>
		b
			.setDescription("Downloads a tiktok video.")
			.addStringOption((b) => b.setName("url").setDescription("The url to the video").setRequired(true)),
	async execute({ interaction }) {
		await downloadTiktokVideo(interaction);
	},
});
