import database from "../database.js";
import { cleanForSpeaking, queueSound, textToSpeech } from "../voice.js";
import createEvent from "./../event.js";

export default createEvent({
	event: "voiceStateUpdate",
	async on({ client }, oldState, newState) {
		const member = newState.member ?? oldState.member;
		if (
			!member ||
			member.user.bot ||
			member.guild !== client.guild ||
			// user changed channels, not changed muted state etc.
			oldState.channel === newState.channel
		)
			return;
		// we have to think about users being moved to another channel too
		// even though discord plays a disconnect and connect sound effect when someone
		// moves themselves (clicks on another channel, not drag-n-drop) to another channel, this event fires
		// with the old channel and new one, not two times as one might expect

		// only say it if someone other than the active user will hear it
		if (newState.channel && newState.channel.members.filter((v) => !v.user.bot).size > 1)
			queueSound(
				client,
				newState.channel,
				await textToSpeech(
					cleanForSpeaking(`${member.displayName} joined`),
					await database.getFlag("tts.voice"),
				),
			);
		if (oldState.channel && oldState.channel.members.filter((v) => !v.user.bot).size > 0)
			queueSound(
				client,
				oldState.channel,
				await textToSpeech(cleanForSpeaking(`${member.displayName} left`), await database.getFlag("tts.voice")),
			);
	},
});
