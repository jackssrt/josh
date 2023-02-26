import { PermissionFlagsBits } from "discord.js";
import { inspect } from "node:util";
import type Client from "../client.js";
import type Command from "../command.js";
import { errorEmbeds } from "../utils.js";

// This function cleans up and prepares the
// result of our eval command input for sending
// to the channel
async function clean(client: Client<true>, text: unknown): Promise<string> {
	// If our input is a promise, await it before continuing
	if (text && text instanceof Promise) text = await text;

	// If the response isn't a string, `util.inspect()`
	// is used to 'stringify' the code in a safe way that
	// won't error out on objects with circular references
	// (like Collections, for example)
	if (typeof text !== "string") text = inspect(text, { depth: 1 });

	// Replace symbols with character code alternatives
	text = (text as string)
		.replace(client.token, "[REDACTED]")
		.replace(/`/g, "`" + String.fromCharCode(8203))
		.replace(/@/g, "@" + String.fromCharCode(8203));

	// Send off the cleaned up result
	return text as string;
}

export default {
	data: (b) =>
		b
			.setDescription("eval")
			.addStringOption((b) => b.setDescription("code").setName("code").setRequired(true))
			.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
	async execute({ client, interaction }) {
		if (interaction.user.id !== process.env["OWNER_ID"]!)
			return await interaction.reply("Only the developer can run this command!");
		client;
		try {
			const evaled = eval(
				interaction.options.getString("code", true).replace("client.token", '"[haha no you don\'t]"'),
			) as unknown;
			const cleaned = await clean(client, evaled);
			!interaction.replied &&
				(await interaction.reply({ content: `\`\`\`js\n${cleaned}\n\`\`\``, ephemeral: true }));
		} catch (e) {
			!interaction.replied &&
				(await interaction.reply({
					...(await errorEmbeds({ title: "eval error", description: inspect(e, { depth: 1 }) })),
				}));
		}
	},
} as Command;
