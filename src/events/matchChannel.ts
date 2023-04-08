import { ChannelType } from "discord.js";
import getEnv from "../env.js";
import type Event from "../event";

export default {
	event: "voiceStateUpdate",
	async on(_, oldState, newState) {
		if (!newState.member) return;
		if (newState.channelId === getEnv("CREATE_MATCH_CHANNEL_ID")) {
			const channel = await newState.guild.channels.create({
				type: ChannelType.GuildVoice,
				name: `⚽・${newState.member.displayName}`,
				userLimit: 4,
				parent: getEnv("MATCH_CHANNEL_CATEGORY_ID"),
			});
			await newState.member.voice.setChannel(channel);
		} else if (
			oldState.channel?.parentId === getEnv("MATCH_CHANNEL_CATEGORY_ID") &&
			oldState.channel.id !== getEnv("CREATE_MATCH_CHANNEL_ID") &&
			oldState.channel.members.size === 0
		)
			await oldState.channel.delete();
	},
} as Event<"voiceStateUpdate">;
