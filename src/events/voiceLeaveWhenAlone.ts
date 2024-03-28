import createEvent from "../commandHandler/event.js";
import { queue } from "../voice.js";

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
