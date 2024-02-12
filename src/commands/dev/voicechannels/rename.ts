import createSubcommand from "@/commandHandler/subcommand.js";
import { updateChannelName } from "@/events/expandingVoiceChannels.js";
import { parallel } from "@/utils/promise.js";
import { pluralize } from "@/utils/string.js";
import { ChannelType, type VoiceChannel } from "discord.js";
import { finish } from "../index.js";

export default createSubcommand({
	data: (b) => b.setDescription("Rename voice channels"),
	defer: "ephemeral",
	async execute({ client, interaction }) {
		const result = await parallel(
			...[
				...client.voiceCategory.children.cache
					.filter((v): v is VoiceChannel => v.type === ChannelType.GuildVoice)
					.sort((a, b) => a.position - b.position)
					.values(),
			].map(async (v, i) => {
				await updateChannelName(v, i + 1);
			}),
			...[
				...client.unusedVoiceCategory.children.cache
					.filter((v): v is VoiceChannel => v.type === ChannelType.GuildVoice)
					.sort((a, b) => a.position - b.position)
					.values(),
			].map(async (v, i) => {
				await updateChannelName(v, i + 1 + client.voiceCategory.children.cache.size);
			}),
		);
		await finish(interaction, `renamed ${result.length} ${pluralize("channel", result.length)}`);
	},
});
