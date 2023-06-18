import { consola } from "consola";
import type { VoiceBasedChannel } from "discord.js";
import { ChannelType, type CategoryChannel, type CategoryChildChannel, type VoiceChannel } from "discord.js";
import getEnv from "../env.js";
import type Event from "../event.js";
import { parallel } from "../utils.js";

const SUPERSCRIPT_NUMBERS = ["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"] as const;
interface ChannelData {
	channel: VoiceChannel;
	used: boolean;
}

const channels: (ChannelData | undefined)[] = [];

function numberToSuperscript(x: number): string {
	return x !== 1
		? x
				.toString()
				.split("")
				.reduce((acc, v) => acc + SUPERSCRIPT_NUMBERS[+v]!, "")
		: "";
}
function superscriptToNumber(x: string): number | undefined {
	const num = parseInt(
		x
			.split("")
			.flatMap((v) => {
				const idx = (SUPERSCRIPT_NUMBERS as readonly string[]).findIndex((x) => x === v);
				return idx !== -1 ? idx : [];
			})
			.join(""),
	);
	return !Number.isNaN(num) ? num : undefined;
}

async function addChannel(category: CategoryChannel) {
	const channel = channels.find((v) => v && !v.used);
	if (!channel) throw new Error("Out of extra voice channels to use!");
	channel.used = true;
	await channel.channel.setParent(category);
}
async function removeChannel(channel: ChannelData, unusedCategory: CategoryChannel) {
	if (!channel.used) return consola.warn("Attempted to remove unused channel");
	channel.used = false;
	await channel.channel.setParent(unusedCategory);
}

export async function updateChannelName(channel: VoiceBasedChannel, num: number) {
	const newName = `🔊・general${numberToSuperscript(num)}`;
	if (channel.name !== newName) await channel.setName(newName);
}

async function updateChannels(category: CategoryChannel, unusedCategory: CategoryChannel) {
	// save last channel from being moved
	let willRemove: ChannelData[] = [];
	let savedChannel = false;
	for (const v of channels) {
		if (!v?.used) continue;
		if (v.channel.members.size > 0) {
			willRemove = [];
			savedChannel = false;
		} else if (!savedChannel) savedChannel = true;
		else willRemove.push(v);
	}

	// there are no extra empty channels at the end in the category
	// bring one in
	if (!savedChannel) await addChannel(category);

	// move channels
	await parallel(willRemove.map(async (v) => removeChannel(v, unusedCategory)));
}
export default [
	{
		event: "voiceStateUpdate",
		async on({ client }, oldState, newState) {
			const category = [newState.channel?.parent, oldState.channel?.parent].find(
				(v) => v?.id === getEnv("VOICE_CATEGORY_ID"),
			);
			if (!category) return;
			await updateChannels(
				category,
				(await client.channels.fetch(getEnv("UNUSED_VOICE_CATEGORY_ID"))) as CategoryChannel,
			);
		},
	} as Event<"voiceStateUpdate">,
	{
		event: "ready",
		async on({ client }) {
			const used = (await client.channels.fetch(getEnv("VOICE_CATEGORY_ID"))) as CategoryChannel;
			const unused = (await client.channels.fetch(getEnv("UNUSED_VOICE_CATEGORY_ID"))) as CategoryChannel;
			function addChannels(v: CategoryChildChannel, used: boolean) {
				if (v.type !== ChannelType.GuildVoice) return;
				const i = superscriptToNumber(v.name.slice("🔊・general".length));
				channels[(i ?? 1) - 1] = { channel: v, used };
			}
			used.children.cache.forEach((v) => addChannels(v, true));
			unused.children.cache.forEach((v) => addChannels(v, false));
			await updateChannels(used, unused);
		},
	} as Event<"ready">,
];
