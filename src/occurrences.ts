import type { Awaitable, Snowflake } from "discord.js";
import { GuildScheduledEventEntityType, GuildScheduledEventPrivacyLevel } from "discord.js";
import type Client from "./client.js";
import database from "./database.js";
import type { StrictOmit } from "./types/utils.js";

export type OccurrenceUpdateData = {
	id: string;
	title: string;
	description: string;
	startTime: Date;
	image: (data: OccurrenceUpdateData) => Awaitable<Buffer>;
};

export type DatabaseOccurenceData = Partial<
	StrictOmit<OccurrenceUpdateData, "startTime" | "id" | "image"> & {
		discordEventId: Snowflake;
	}
>;

const sharedOccurrenceAndUpdateDataProperties = [
	"title",
	"description",
] as const satisfies (keyof OccurrenceUpdateData & keyof DatabaseOccurenceData)[];

function compareOccurrenceData(oldData: DatabaseOccurenceData, newData: OccurrenceUpdateData): boolean {
	return sharedOccurrenceAndUpdateDataProperties.some((v) => oldData[v] !== newData[v]);
}

/**
 * This function creates or updates an occurrence.\
 * Some limitations are:
 * - The image only gets generated when creating the event.
 * - The startTime can not be changed.
 */
export default async function updateOccurrence(client: Client<true>, data: OccurrenceUpdateData) {
	const { id, title, description, startTime, image } = data;

	// get occurrence data from database
	const oldData = await database.getOccurrenceById(id);

	// compare new data to old data
	if (oldData && !compareOccurrenceData(oldData, data)) return;

	// fetch event
	let event = oldData && (await client.guild.scheduledEvents.fetch(oldData.discordEventId));

	// update event
	if (!event)
		event = await client.guild.scheduledEvents.create({
			entityType: GuildScheduledEventEntityType.External,
			name: title,
			description,
			image: await image(data),
			scheduledStartTime: startTime,
			privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
			reason: "Occurrences managed",
		});
	else await event.edit({ name: title, description });

	// save
	await database.saveOccurrence(id, {
		title,
		description,
		discordEventId: event.id,
	});
}
