import type { GuildTextBasedChannel, MessageCreateOptions, Snowflake } from "discord.js";
import { bold, inlineCode, roleMention, userMention } from "discord.js";
import type Client from "./client.js";
import database from "./database.js";
import { SQUID_SHUFFLE_EMOJI } from "./emojis.js";
import logger from "./logger.js";
import type { If } from "./utils.js";
import {
	dedent,
	deleteStaticMessage,
	embeds,
	messageHiddenText,
	parallel,
	reportError,
	sequential,
	updateStaticMessage,
} from "./utils.js";

//#region Shared

export type AnnouncementData<UserMade extends boolean = boolean> = {
	authorId: If<UserMade, string>;

	title: string;
	titleMessageId: If<UserMade, Snowflake>;
	description: string;
	descriptionMessageId: If<UserMade, Snowflake>;
	hiddenText: string | undefined;
	hiddenTextMessageId: If<UserMade, Snowflake | undefined>;
	mentioned:
		| {
				users: string[];
				everyone: boolean;
				roles: string[];
		  }
		| undefined;
	mentionedMessageId: If<UserMade, Snowflake | undefined>;

	previewMessageId: If<UserMade, Snowflake>;
	previewChannelId: If<UserMade, Snowflake>;
};
export type AnnouncementDataForKey<T extends string> =
	| AnnouncementData<T extends `user-${string}` ? true : false>
	| undefined;

function generateMentionedString(mentioned: NonNullable<AnnouncementData["mentioned"]>) {
	return [
		mentioned.everyone && "@everyone",
		...mentioned.users.map((v) => userMention(v)),
		...mentioned.roles.map((v) => roleMention(v)),
	]
		.filter(Boolean)
		.join(" ");
}

export async function generatePublishedAnnouncementContent(
	client: Client<true>,
	{ authorId, title, description, mentioned, hiddenText }: Partial<AnnouncementData>,
) {
	const content = `${mentioned ? generateMentionedString(mentioned) : ""}${
		hiddenText ? messageHiddenText(hiddenText) : ""
	}`;
	const author = authorId && (await client.guild.members.fetch(authorId));

	return {
		...(await embeds((b) =>
			b
				.setAuthor(
					author
						? {
								name: author.displayName,
								iconURL: author.displayAvatarURL(),
							}
						: null,
				)
				.setTitle(title?.trim() ?? "Untitled")
				.setDescription(description?.trim() ?? "No description yet..."),
		)),
		...(content ? { content } : {}),
		components: [],
	} as const satisfies MessageCreateOptions;
}

export async function updatePublishedAnnouncement(client: Client<true>, id: string, silent = false): Promise<boolean> {
	const announcement = await database.getAnnouncement(id);
	if (!announcement) {
		if (!silent) logger.warn("attempt to update non existant published announcement with id", id);
		return false;
	}

	await updateStaticMessage(
		client.announcementsChannel,
		`announcements-${id}`,
		await generatePublishedAnnouncementContent(client, announcement),
	);
	return true;
}
export async function deleteAnnouncement(client: Client<true>, id: string) {
	const data = await database.getAnnouncement(id);

	const channel =
		data?.previewChannelId && ((await client.channels.fetch(data.previewChannelId)) as GuildTextBasedChannel);
	if (!data || !channel) return false;
	await parallel(
		database.deleteAnnouncement(id),
		sequential(
			(
				[
					"titleMessageId",
					"descriptionMessageId",
					"hiddenTextMessageId",
					"mentionedMessageId",
					"previewMessageId",
				] as const satisfies (keyof AnnouncementData)[]
			).map((v) => async () => {
				if (!data[v]) return;
				await database.unlinkMessageIdFromAnnouncementSource(data[v]!);
			}),
		),

		channel.bulkDelete(
			(
				[
					"titleMessageId",
					"descriptionMessageId",
					"hiddenTextMessageId",
					"mentionedMessageId",
					"previewMessageId",
				] as const satisfies (keyof AnnouncementData)[]
			).flatMap((v) => data[v] ?? []),
		),
		deleteStaticMessage(client.announcementsChannel, `announcements-${id}`),
	);
	return true;
}

//#endregion

//#region Programmable
export async function updateProgrammableAnnouncement(client: Client<true>, id: string, data: AnnouncementData<false>) {
	await database.setAnnouncement(id, data);
	await updatePublishedAnnouncement(client, id);
}
//#endregion

//#region User
export const editableAnnouncementMessageIdTypes = [
	"titleMessageId",
	"descriptionMessageId",
	"hiddenTextMessageId",
	"mentionedMessageId",
] as const satisfies (keyof AnnouncementData<true>)[];
export type EditableAnnouncementMessageIdType = (typeof editableAnnouncementMessageIdTypes)[number];

export async function generatePreviewAnnouncementContent(
	client: Client<true>,
	id: string,
	data: Partial<AnnouncementData<true>>,
	index: number,
) {
	const published = await generatePublishedAnnouncementContent(client, data);
	return {
		...published,
		embeds: published.embeds.concat(
			(
				await embeds((b) =>
					b.setTitle("New announcement...").setDescription(
						dedent`Send a message in this channel to fill in these fields:
										${["Title", "Description", "Hidden Text", "Mentions"]
											.map((v, i) => `- ${index > i ? "✅" : SQUID_SHUFFLE_EMOJI} ${v}`)
											.join("\n")}
											${
												index > 3
													? dedent`${bold("Announcement created with id:")}
																${inlineCode(id)}`
													: ""
											}`,
					),
				)
			).embeds,
		),
	} as const satisfies MessageCreateOptions;
}

async function updatePreviewAnnouncement(client: Client<true>, id: string, data: AnnouncementData<true>) {
	const message = await (
		(await client.channels.fetch(data.previewChannelId)) as GuildTextBasedChannel | undefined
	)?.messages.fetch(data.previewMessageId);
	if (!message) return;
	await message.edit(await generatePreviewAnnouncementContent(client, id, data, 5));
}

export async function updateUserAnnouncement(
	client: Client<true>,
	id: `user-${string}`,
	data: Partial<AnnouncementData<true>>,
) {
	const existingData = await database.getAnnouncement(id);
	if (!existingData) {
		reportError({
			title: "Attempt to update non existant announcement",
			description: `With id ${id}`,
			error: new Error(),
		});
		return;
	}

	const mergedData = {
		...existingData,
		...data,
	};
	await parallel(database.setAnnouncement(id, mergedData), updatePreviewAnnouncement(client, id, mergedData));
}

export async function createUserAnnouncement(id: `user-${string}`, data: AnnouncementData<true>) {
	await parallel(
		database.setAnnouncement(id, data),
		sequential(
			...editableAnnouncementMessageIdTypes.map(
				// non null assertion because checked before
				(v) => async () => data[v] && (await database.linkMessageIdToAnnouncementSource(data[v]!, id, v)),
			),
		),
	);
}

//#endregion
