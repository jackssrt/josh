import { ChannelType } from "discord.js";
import createEvent from "./../event.js";

export default createEvent({
	event: "voiceStateUpdate",
	async on(_, oldState, newState) {
		if (!newState.member) return;
		if (newState.channelId === process.env.CREATE_MATCH_CHANNEL_ID) {
			const channel = await newState.guild.channels.create({
				type: ChannelType.GuildVoice,
				name: `⚽・${newState.member.displayName}`,
				userLimit: 4,
				parent: process.env.MATCH_CHANNEL_CATEGORY_ID,
			});
			await newState.member.voice.setChannel(channel);
		} else if (
			oldState.channel?.parentId === process.env.MATCH_CHANNEL_CATEGORY_ID &&
			oldState.channel.id !== process.env.CREATE_MATCH_CHANNEL_ID &&
			oldState.channel.members.size === 0
		)
			await oldState.channel.delete();
	},
});
