import { spawn } from "child_process";
import { randomUUID } from "crypto";
import type { Message } from "discord.js";
import ffmpegPath from "ffmpeg-static";
import FfmpegCommand from "fluent-ffmpeg";
import { unlink } from "fs/promises";
import type Client from "../client.js";
import { SQUID_SHUFFLE_EMOJI } from "../emojis.js";
import createEvent from "../event.js";
import logger from "../logger.js";
import { awaitEvent, canReplaceMessage, messageHiddenText, pawait, replaceMessage, reportError } from "../utils.js";
if (ffmpegPath) FfmpegCommand.setFfmpegPath(ffmpegPath);

const tiktokUrlRegex = /https?:\/\/(www\.)?(vm\.tiktok\.com|(m\.)?tiktok\.com)\/(((@[^/]+\/video|v)\/([^/]+))|\S+)/g;
export async function downloadTiktokVideos(client: Client<true>, message: Message) {
	const tiktokLink = message.content.match(tiktokUrlRegex)?.[0]?.replace(/\?.*/g, "");

	if (!tiktokLink || !message.member || !canReplaceMessage(message)) return;
	const progressMessage = await message.reply(`${SQUID_SHUFFLE_EMOJI} Downloading tiktok video...`);
	// download using yt-dlp
	const ytDlpProcess = spawn("yt-dlp", [tiktokLink, "-f", "mp4", "-o", "-"]);
	const id = randomUUID();

	// re-encode video for discord embed
	const cmd = FfmpegCommand(ytDlpProcess.stdout).saveToFile(`./temp/${id}.mp4`);
	cmd.run();

	await awaitEvent(cmd, "end"); // wait for re-encode to finish

	// get cdn link
	await progressMessage.edit(`${SQUID_SHUFFLE_EMOJI} Uploading to discord...`);
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
		await progressMessage.edit(`Tiktok video download failed :(`);
		return;
	}
	const discordLink = altMessageResult.value.attachments.first()?.url;
	if (!discordLink) {
		logger.error("no discord link");
		return;
	}

	// clean up and finalize
	await Promise.allSettled([
		progressMessage.delete(),
		message.delete(),
		unlink(`./temp/${id}.mp4`),
		replaceMessage(client, message, {
			content: `${message.content.replace(tiktokUrlRegex, "<$&>")}${messageHiddenText(discordLink)}`,
		}),
	]);
}

export default createEvent({
	event: "messageCreate",
	async on({ client }, message) {
		if (message.guild !== client.guild) return;
		await downloadTiktokVideos(client, message);
	},
});
