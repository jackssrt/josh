import type { VoiceBasedChannel } from "discord.js";
import { ChannelType, type CategoryChannel, type CategoryChildChannel, type VoiceChannel } from "discord.js";
import createEvent from "../commandHandler/event.js";
import logger from "../utils/Logger.js";
import { parallel } from "../utils/promise.js";

const SUPERSCRIPT_NUMBERS = ["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"] as const;
type ChannelData = {
	channel: VoiceChannel;
	used: boolean;
};

const channels: (ChannelData | undefined)[] = [];

function numberToSuperscript(x: number): string {
	return x === 1 ? "" : [...`${x}`].reduce((acc, v) => acc + SUPERSCRIPT_NUMBERS[+v]!, "");
}
function superscriptToNumber(x: string): number | undefined {
	const num = Number.parseInt(
		[...x]
			.flatMap((v) => {
				const idx = (SUPERSCRIPT_NUMBERS as readonly string[]).indexOf(v);
				return idx === -1 ? [] : idx;
			})
			.join(""),
	);
	return Number.isNaN(num) ? undefined : num;
}

async function addChannel(category: CategoryChannel) {
	const channel = channels.find((v) => v && !v.used);
	if (!channel) throw new Error("Out of extra voice channels to use!");
	channel.used = true;
	await channel.channel.setParent(category);
}
async function removeChannel(channel: ChannelData, unusedCategory: CategoryChannel) {
	if (!channel.used) {
		logger.warn("Attempted to remove unused channel");
		return;
	}
	channel.used = false;
	await channel.channel.setParent(unusedCategory);
}

export async function updateChannelName(channel: VoiceBasedChannel, num: number) {
	const newName = `🔊・general${numberToSuperscript(num)}`;
	if (channel.name !== newName) await channel.setName(newName);
}

export async function updateChannels(category: CategoryChannel, unusedCategory: CategoryChannel) {
	// save last channel from being moved
	let willRemove: ChannelData[] = [];
	let savedChannel = false;
	for (const v of channels) {
		if (!v?.used) continue;
		if (v.channel.members.size > 0) {
			willRemove = [];
			savedChannel = false;
		} else if (savedChannel) {
			willRemove.push(v);
		} else {
			savedChannel = true;
		}
	}

	// there are no extra empty channels at the end in the category
	// bring one in
	if (!savedChannel) await addChannel(category);

	// move channels
	await parallel(willRemove.map(async (v) => removeChannel(v, unusedCategory)));
}

function populateChannelsArray(v: CategoryChildChannel, used: boolean) {
	if (v.type !== ChannelType.GuildVoice) return;
	const i = superscriptToNumber(v.name.slice("🔊・general".length));
	channels[(i ?? 1) - 1] = { channel: v, used };
}

export default [
	createEvent({
		event: "voiceStateUpdate",
		async on({ client }, oldState, newState) {
			const category = [newState.channel?.parent, oldState.channel?.parent].find(
				(v) => v?.id === process.env.VOICE_CATEGORY_ID,
			);
			if (!category) return;
			await updateChannels(category, client.unusedVoiceCategory);
		},
	}),
	createEvent({
		event: "ready",
		async on({ client }) {
			for (const v of client.voiceCategory.children.cache.values()) populateChannelsArray(v, true);
			for (const v of client.unusedVoiceCategory.children.cache.values()) populateChannelsArray(v, false);
			await updateChannels(client.voiceCategory, client.unusedVoiceCategory);
		},
	}),
];
