import { updatePublishedAnnouncement } from "@/announcements.js";
import createSubcommand from "@/commandHandler/subcommand.js";
import { inlineCode } from "discord.js";
import { addIdOption, idAutocomplete } from "./index.js";

export default createSubcommand({
	data: (b) => b.setDescription("Publishes an announcement.").addStringOption(addIdOption),
	autocomplete: idAutocomplete,
	async execute({ client, interaction }) {
		const id = interaction.options.getString("id", true);
		if (await updatePublishedAnnouncement(client, id))
			await interaction.reply(`successfully published announcement with id ${inlineCode(id)}`);
		else await interaction.reply(`there is no announcement with id ${inlineCode(id)}`);
	},
});
