import { PermissionFlagsBits } from "discord.js";
import { inspect } from "node:util";
import type Client from "../client.js";
import { embeds } from "../utils/discord/embeds.js";
import { impersonate } from "../utils/discord/messages.js";
import createCommand from "./../command.js";

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
		.replace(new RegExp(client.token.replace(/\./g, "\\."), "gi"), "[REDACTED]")
		.replace(/`/g, "`" + String.fromCharCode(8203))
		.replace(/@/g, "@" + String.fromCharCode(8203));

	// Send off the cleaned up result
	return text as string;
}

export default createCommand({
	data: (b) =>
		b
			.setDescription("eval")
			.addStringOption((b) => b.setDescription("code").setName("code").setRequired(true))
			.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
	ownerOnly: true,
	async execute({ client, interaction }) {
		client;
		embeds;
		impersonate;
		const evaled = eval(
			`(async function() {\n${interaction.options
				.getString("code", true)
				.replace(/client\.token/g, '"[haha no you don\'t]"')}\n})()`,
		) as unknown;

		const cleaned = await clean(client, evaled);
		if (!interaction.replied) await interaction.reply({ content: `\`\`\`js\n${cleaned}\n\`\`\``, ephemeral: true });
	},
});
