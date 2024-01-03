import type { GuildTextBasedChannel, Message, MessageCreateOptions, MessageEditOptions } from "discord.js";
import database from "./database.js";

export async function updateStaticMessage(
	channel: GuildTextBasedChannel,
	id: string,
	content: string | (MessageEditOptions & MessageCreateOptions),
): Promise<Message<true>> {
	const messageId = await database.getStaticMessageId(id);
	const message = messageId && (await channel.messages.fetch(messageId).catch(() => undefined));
	if (message) {
		return await message.edit(content);
	} else {
		const message = await channel.send(content);
		await database.setStaticMessageId(id, message.id);
		return message;
	}
}

export async function deleteStaticMessage(channel: GuildTextBasedChannel, id: string) {
	const messageId = await database.getStaticMessageId(id);
	const message = messageId && (await channel.messages.fetch(messageId));
	if (message && message.deletable) await message.delete();
	await database.deleteStaticMessageId(id);
}
