import { queue } from "../voice.js";
import createEvent from "./../event.js";

export default createEvent({
	event: "voiceStateUpdate",
	async on({ client }, oldState) {
		const { voice } = client.guildMe;
		if (oldState.channel?.id === voice.channel?.id && voice.channel?.members.size === 1) {
			queue.clear();
			await voice.disconnect();
		}
	},
});
