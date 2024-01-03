import type { Channel, Message, User, Webhook, WebhookMessageCreateOptions } from "discord.js";
import { GuildMember, MessageFlags } from "discord.js";
import type Client from "../../client.js";
import type { WebhookableChannel } from "../../utils";
import { parallel } from "../promise.js";

//#region impersonate
const IMPERSONATION_WEBHOOK_NAME = "josh impersonation webhook";
export async function impersonate(
	client: Client<true>,
	user: GuildMember | User,
	channel: WebhookableChannel,
	message: string | WebhookMessageCreateOptions,
): Promise<[Message, Webhook]> {
	const webhook =
		(await channel.fetchWebhooks()).find((v) => v.token !== null && v.name === IMPERSONATION_WEBHOOK_NAME) ??
		(await channel.createWebhook({
			name: IMPERSONATION_WEBHOOK_NAME,
			reason: "impersonation webhook",
			avatar: client.user.displayAvatarURL({ size: 128 }),
		}));
	return [
		await webhook.send({
			avatarURL: user.displayAvatarURL({ size: 128 }),
			username: `${user instanceof GuildMember ? user.displayName : user.username}`,
			allowedMentions: { parse: [] },
			...(typeof message === "string" ? { content: message } : message),
		} satisfies WebhookMessageCreateOptions),
		webhook,
	];
}
//#endregion

//#region replaceMessage
export type ReplaceableMessage = Message<true> & { channel: WebhookableChannel };

export function canReplaceMessage(message: Message): message is ReplaceableMessage {
	return message.inGuild() && !!(message.channel as Channel & WebhookableChannel).fetchWebhooks;
}

export async function replaceMessage(
	client: Client<true>,
	message: ReplaceableMessage,
	newData: string | WebhookMessageCreateOptions,
): Promise<[Message, Webhook]> {
	return (
		await parallel(
			message.deletable && message.delete(),
			impersonate(client, message.member ?? message.author, message.channel, {
				flags: MessageFlags.SuppressNotifications,
				allowedMentions: {
					parse: [],
				},
				...(typeof newData === "string" ? { content: newData } : newData),
			}),
		)
	)[1];
}
//#endregion
