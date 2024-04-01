import createEvent from "@/commandHandler/event.js";
import { embeds } from "@/utils/discord/embeds.js";
import { getImpersonationWebhook, impersonate, sendImpersonationMessage } from "@/utils/discord/messages.js";
import { formatTime } from "@/utils/time.js";
import { Collection, Colors, channelMention, userMention, type Snowflake } from "discord.js";

const sessions = new Collection<Snowflake, number>();

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
		const webhook = await getImpersonationWebhook(client, client.voiceLogChannel);
		if (newState.channel && oldState.channel) {
			// moved
			const message = await sendImpersonationMessage(webhook, member, {
				content: `↪️ @${member.displayName} moved from #${oldState.channel.name} to #${newState.channel.name}`,

				allowedMentions: { parse: [] },
			});

			await webhook.editMessage(message, {
				content: "",
				...(await embeds((b) =>
					b
						.setDescription(
							// already checked before
							`↪️ ${userMention(member.id)} moved from ${channelMention(oldState.channel!.id)} to ${channelMention(newState.channel!.id)}`,
						)
						.setColor(Colors.Aqua),
				)),
				allowedMentions: { parse: [] },
			});
		} else if (newState.channel) {
			// joined
			sessions.set(member.id, Date.now());

			const [message, webhook] = await impersonate(client, member, client.voiceLogChannel, {
				content: `🟩 @${member.displayName} joined #${newState.channel.name}`,
				allowedMentions: { parse: [] },
			});

			await webhook.editMessage(message, {
				content: "",
				...(await embeds((b) =>
					// already checked before
					b
						.setDescription(`🟩 ${userMention(member.id)} joined ${channelMention(newState.channel!.id)}`)
						.setColor(Colors.Green),
				)),
				allowedMentions: { parse: [] },
			});
		} else if (oldState.channel) {
			// left
			const joinedTimestamp = sessions.get(member.id);

			sessions.delete(member.id);

			const sessionLength = joinedTimestamp
				? `, their session lasted ${formatTime((Date.now() - joinedTimestamp) / 1000)}`
				: "";

			const [message, webhook] = await impersonate(client, member, client.voiceLogChannel, {
				content: `🟥 @${member.displayName} left #${oldState.channel.name}${sessionLength}`,
				allowedMentions: { parse: [] },
			});

			await webhook.editMessage(message, {
				content: "",
				...(await embeds((b) =>
					// already checked before
					b
						.setDescription(
							`🟥 ${userMention(member.id)} left ${channelMention(oldState.channel!.id)}${sessionLength}`,
						)
						.setColor(Colors.Red),
				)),
				allowedMentions: { parse: [] },
			});
		}
	},
});
