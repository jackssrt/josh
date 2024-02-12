import createSubcommand from "@/commandHandler/subcommand.js";
import { updateChannels } from "@/events/expandingVoiceChannels.js";
import { finish } from "../index.js";

export default createSubcommand({
	data: (b) => b.setDescription("Reruns expanding voice channels"),
	defer: "ephemeral",
	async execute({ client, interaction }) {
		await updateChannels(client.voiceCategory, client.unusedVoiceCategory);
		await finish(interaction);
	},
});
