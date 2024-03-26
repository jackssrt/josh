import database from "../database.js";
import { canReplaceMessage, replaceMessage } from "../utils/discord/messages.js";
import createEvent from "./../commandHandler/event.js";

export default createEvent({
	event: "messageCreate",
	async on({ client }, message) {
		if (
			message.guild !== client.guild ||
			message.author.id !== (await database.getFlag("message.awesomeTroll.target")) ||
			!canReplaceMessage(message)
		)
			return;
		await replaceMessage(client, message, {
			content: `${message.content.replaceAll(
				/(<a?:.+?:\d{18}>)|(\p{Extended_Pictographic})/gu,
				"<:awesomeFace:1133082514928443492>",
			)} <:awesomeFace:1133082514928443492>`,
			avatarURL: "https://cdn.discordapp.com/emojis/1133082514928443492.webp?size=96&quality=lossless",
			files: [...message.attachments.values()],
		});
	},
});
