import { match } from "ts-pattern";
import type { AnnouncementData } from "../announcements.js";
import { updateUserAnnouncement } from "../announcements.js";
import database from "../database.js";
import createEvent from "./../commandHandler/event.js";

export default createEvent({
	event: "messageUpdate",
	async on({ client }, oldMessage, newMessage) {
		if (
			(oldMessage.content === newMessage.content &&
				oldMessage.mentions.toJSON() === newMessage.mentions.toJSON()) ||
			newMessage.content === null
		)
			return;
		const announcementRes = await database.getAnnouncementByMessageId(newMessage.id);
		if (!announcementRes) return;
		const [id, type] = announcementRes;
		await updateUserAnnouncement(
			client,
			id,
			match(type)
				.returnType<Partial<AnnouncementData>>()
				// non null assertion because newMessage.content is checked before
				.with("titleMessageId", () => ({ title: newMessage.content! }))
				.with("descriptionMessageId", () => ({ description: newMessage.content! }))
				.with("hiddenTextMessageId", () => ({ hiddenText: newMessage.content! }))
				.with("mentionedMessageId", () => ({
					mentioned: {
						users: newMessage.mentions.users.map((v) => v.id),
						roles: newMessage.mentions.roles.map((v) => v.id),
						everyone: newMessage.mentions.everyone,
					},
				}))
				.exhaustive(),
		);
	},
});
