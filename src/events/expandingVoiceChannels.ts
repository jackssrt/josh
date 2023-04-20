import type { CategoryChannel, VoiceBasedChannel } from "discord.js";
import getEnv from "../env.js";
import type Event from "../event.js";
import { parallel } from "../utils.js";

const SUPERSCRIPT_NUMBERS = ["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"] as const;

function getSuperscriptNumber(x: number): string {
	return x !== 1
		? x
				.toString()
				.split("")
				.reduce((acc, v) => acc + SUPERSCRIPT_NUMBERS[+v]!, "")
		: "";
}

async function createChannel(category: CategoryChannel, unusedCategory: CategoryChannel) {
	const channel = unusedCategory.children.cache.first();
	if (!channel) throw new Error("Out of extra voice channels to use!");
	if (!channel.isVoiceBased()) return;
	await updateChannelName(channel, category.children.cache.size + 1);
	await channel.setParent(category);
}
async function updateChannelName(channel: VoiceBasedChannel, num: number) {
	const newName = `🔊・general${getSuperscriptNumber(num)}`;
	if (channel.name !== newName) await channel.setName(newName);
}

async function updateChannels(category: CategoryChannel, unusedCategory: CategoryChannel) {
	const channels = category.children.cache.filter((x) => x.isVoiceBased()).sort((a, b) => b.position - a.position);
	// queue empty channels to be moved
	const willMove = channels.filter((v) => v.members.size === 0);
	// save last channel from being moved
	let savedChannel = undefined as string | undefined;
	channels.reverse().forEach((v, k) => {
		if (v.members.size > 0) savedChannel = undefined;
		else if (savedChannel === undefined) savedChannel = k;
	});

	if (savedChannel) willMove.delete(savedChannel);
	// there are no extra empty channels at the end in the category
	// make one
	else await createChannel(category, unusedCategory);

	// move channels
	await parallel(
		willMove.toJSON().map(async (v) => {
			await v.setParent(unusedCategory);
		}),
	);
	// rename new channels
	await parallel(
		category.children.cache
			.filter((x): x is VoiceBasedChannel => x.isVoiceBased())
			.sort((a, b) => a.position - b.position)
			.toJSON()
			.map(async (v, i) => {
				await updateChannelName(v, i + 1);
			}),
	);
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
			await updateChannels(
				(await client.channels.fetch(getEnv("VOICE_CATEGORY_ID"))) as CategoryChannel,
				(await client.channels.fetch(getEnv("UNUSED_VOICE_CATEGORY_ID"))) as CategoryChannel,
			);
		},
	} as Event<"ready">,
];
