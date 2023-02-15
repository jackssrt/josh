import { ChannelType } from "discord.js";
import type Event from "../event";

const adjectives = ["cool", "evasive", "unique", "predictable", "anonymous", "unknown", "known", "popular"];
const nouns = [
	"inkling",
	"octoling",
	"squid game",
	"splatoon",
	"person",
	"player",
	"shop",
	"splatnet",
	"turf war",
	"x battle",
];

export default {
	event: "voiceStateUpdate",
	async on(_, oldState, newState) {
		if (!newState.member) return;
		if (newState.channelId === "1067938899751620648") {
			const channel = await newState.guild.channels.create({
				type: ChannelType.GuildVoice,
				name: `🔊・${adjectives[~~(Math.random() * adjectives.length)] as string} ${
					nouns[~~(Math.random() * nouns.length)] as string
				}`,
				userLimit: 4,
				parent: "1061706281385205910",
			});
			await newState.member.voice.setChannel(channel);
		} else if (
			!newState.channel &&
			oldState.channel &&
			oldState.channel.parentId === "1061706281385205910" &&
			oldState.channel.members.size === 0
		) {
			await oldState.channel.delete();
		}
	},
} as Event<"voiceStateUpdate">;
