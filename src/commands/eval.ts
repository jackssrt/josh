import type { InteractionReplyOptions } from "discord.js";
import { PermissionFlagsBits, codeBlock } from "discord.js";
import { inspect } from "node:util";
import type Client from "../client.js";
import { embeds } from "../utils/discord/embeds.js";
import { impersonate } from "../utils/discord/messages.js";
import createCommand from "./../commandHandler/command.js";

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
		.replaceAll(new RegExp(client.token.replaceAll(".", "\\."), "gi"), "[REDACTED]")
		.replaceAll("`", "`" + String.fromCodePoint(8203))
		.replaceAll("@", "@" + String.fromCodePoint(8203));

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
		// this is in a block to prevent eval from accessing the original reply function
		{
			const reply = interaction.reply.bind(interaction);
			interaction.reply = (async (payload: string | InteractionReplyOptions) => {
				const content = await clean(client, typeof payload === "string" ? payload : payload.content);
				return await reply({
					...(typeof payload === "object" ? payload : {}),
					content: content,
				});
			}) as unknown as (typeof interaction)["reply"];
		}
		const evaled = eval(
			`(async function() {\n${interaction.options.getString("code", true)}\n})()`,
		) as Promise<unknown>;

		const cleaned = await clean(client, evaled);
		if (!interaction.replied) await interaction.reply({ content: codeBlock("js", cleaned), ephemeral: true });
	},
});
