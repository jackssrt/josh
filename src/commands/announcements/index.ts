import createCommand from "@/commandHandler/command.js";
import type { AutocompleteParam } from "@/commandHandler/shared.js";
import database from "@/database.js";
import { search } from "@/utils/array.js";
import type { SlashCommandStringOption } from "discord.js";

export async function idAutocomplete({ interaction }: AutocompleteParam) {
	const focused = interaction.options.getFocused(true);
	if (focused.name !== "id") return;
	const announcementIds = await database.getAllAnnouncementIds();
	const results = search(announcementIds, focused.value);
	await interaction.respond(results.slice(0, 25).map((v) => ({ name: v, value: v })));
}

export const addIdOption = (b: SlashCommandStringOption) =>
	b.setName("id").setDescription("Announcement id").setAutocomplete(true).setRequired(true);

export default createCommand({
	data: (b) => b.setDescription("Manage announcements"),
	ownerOnly: true,
});
