import createSubcommand from "@/commandHandler/subcommand.js";
import { updateRoleCategories } from "@/events/roleCategories.js";
import { parallel } from "@/utils/promise.js";
import { pluralize } from "@/utils/string.js";
import { Collection, GuildMember, Role } from "discord.js";
import { finish } from "../index.js";

export default createSubcommand({
	data: (b) =>
		b
			.setDescription("Rerun role categories")
			.addMentionableOption((b) => b.setName("users").setDescription("User(s)").setRequired(true)),
	defer: "ephemeral",
	async execute({ interaction }) {
		const mentionable = interaction.options.getMentionable("users", true);
		const users =
			mentionable instanceof Role
				? mentionable.members
				: mentionable instanceof GuildMember
					? new Collection([[mentionable.id, mentionable]])
					: undefined;
		if (!users) return await interaction.editReply("no users passed in");
		await parallel(users.map(updateRoleCategories));
		await finish(interaction, `affected ${users.size} ${pluralize("member", users.size)}`);
	},
});
