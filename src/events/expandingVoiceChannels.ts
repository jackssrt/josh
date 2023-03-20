import type { CategoryChannel } from "discord.js";
import { ChannelType } from "discord.js";
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

async function createChannel(category: CategoryChannel) {
	await category.children.create({
		type: ChannelType.GuildVoice,
		name: `🔊・general${getSuperscriptNumber(category.children.cache.size + 1)}`,
	});
}

async function updateChannels(category: CategoryChannel) {
	const channels = category.children.cache.sort((a, b) => b.position - a.position);
	// queue empty channels to be deleted
	const willDelete = channels.filter((v) => v.members.size === 0);
	// save last channel from being deleted
	let savedChannel = undefined as string | undefined;
	channels.reverse().forEach((v, k) => {
		if (v.members.size > 0 || !v.isVoiceBased()) savedChannel = undefined;
		else if (savedChannel === undefined) savedChannel = k;
	});

	if (savedChannel) willDelete.delete(savedChannel);
	// there are no extra empty channels at the end in the category
	// make one
	else await createChannel(category);

	// perform the deletions
	await parallel(
		willDelete.toJSON().map(async (v) => {
			if (v.deletable) await v.delete();
		}),
	);
	// rename new channels
	await parallel(
		category.children.cache
			.sort((a, b) => a.position - b.position)
			.toJSON()
			.map(async (v, i) => {
				const newName = `🔊・general${getSuperscriptNumber(i + 1)}`;
				if (v.name !== newName) await v.setName(newName);
			}),
	);
}
export default [
	{
		event: "voiceStateUpdate",
		async on(_, oldState, newState) {
			const category = [newState.channel?.parent, oldState.channel?.parent].find(
				(v) => v?.id === getEnv("VOICE_CATEGORY_ID"),
			);
			if (!category) return;
			await updateChannels(category);
		},
	} as Event<"voiceStateUpdate">,
	{
		event: "ready",
		async on({ client }) {
			await updateChannels((await client.channels.fetch(getEnv("VOICE_CATEGORY_ID"))) as CategoryChannel);
		},
	} as Event<"ready">,
];
