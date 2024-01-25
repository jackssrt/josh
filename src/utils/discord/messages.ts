import type { Channel, Message, User, Webhook, WebhookMessageCreateOptions } from "discord.js";
import { GuildMember, MessageFlags } from "discord.js";
import type Client from "../../client.js";
import database from "../../database.js";
import type { WebhookableChannel } from "../discord/channels.js";
import { parallel } from "../promise.js";

//#region impersonate
const IMPERSONATION_WEBHOOK_NAME = "josh impersonation webhook";
/**
 * Impersonate someone, making a webhook send a message that looks like that person sent it.\
 * This function protects against pinging by default, override this by passing `{allowedMentions: {}}` as the message parameter
 * @param client A ready client to use
 * @param user The GuildMember or User to impersonate
 * @param channel The channel to impersonate the person in
 * @param message The message content
 * @returns Both the Message sent and the Webhook used
 */
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
			username: user instanceof GuildMember ? user.displayName : user.username,
			allowedMentions: { parse: [] },
			...(typeof message === "string" ? { content: message } : message),
		} satisfies WebhookMessageCreateOptions),
		webhook,
	];
}
//#endregion

//#region replaceMessage
/**
 * A message that can be replaced with {@link replaceMessage}
 */
export type ReplaceableMessage = Message<true> & { channel: WebhookableChannel };

/**
 * Custom typeguard for {@link ReplaceableMessage}
 */
export function canReplaceMessage(message: Message): message is ReplaceableMessage {
	return message.inGuild() && !!(message.channel as Channel & WebhookableChannel).fetchWebhooks;
}

/**
 * Replace a message sent by someone to alter the contents, uses {@link impersonate}.\
 * The resulting new message will be \@silent and not ping anyone.\
 * The original message passed in will be deleted if possible.\
 * Lets the user delete and edit the replaced message.
 * @param client A ready client to use
 * @param message The message to replace
 * @param newData The new message data
 * @returns Both the new message and the webhook used
 */
export async function replaceMessage(
	client: Client<true>,
	message: ReplaceableMessage,
	newData: string | WebhookMessageCreateOptions,
): Promise<[Message, Webhook]> {
	const impersonateReturn = (
		await parallel(
			impersonate(client, message.member ?? message.author, message.channel, {
				flags: MessageFlags.SuppressNotifications,
				allowedMentions: {
					parse: [],
				},
				...(typeof newData === "string" ? { content: newData } : newData),
			}),
			message.deletable && message.delete(),
		)
	)[0];
	await database.setReplacedMessage(impersonateReturn[0].id, message.author.id);
	return impersonateReturn;
}
//#endregion
