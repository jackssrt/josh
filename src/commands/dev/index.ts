import createCommand, { type DeferredInteraction } from "@/commandHandler/command.js";
import { embeds } from "@/utils/discord/embeds.js";
import { Colors, type ChatInputCommandInteraction, type InteractionEditReplyOptions } from "discord.js";

export async function finish(
	interaction: DeferredInteraction<ChatInputCommandInteraction>,
	extra: Partial<InteractionEditReplyOptions> | string | null = null,
) {
	await interaction.editReply({
		...(await embeds((b) => b.setTitle("Dev command finished").setColor(Colors.Green))),
		...(typeof extra === "object" ? extra : null),
	});
}

export default createCommand({
	data: (b) => b.setDescription("Developer only command").setDMPermission(false),
	ownerOnly: true,
});
