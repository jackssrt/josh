import type Event from "../event.js";
import { queue } from "../voice.js";

export default {
	event: "voiceStateUpdate",
	async on({ client }, oldState) {
		const { voice } = client.guildMe;
		if (oldState.channel?.id === voice.channel?.id && voice.channel?.members.size === 1) {
			queue.clear();
			await voice.disconnect();
		}
	},
} as Event<"voiceStateUpdate">;
