import createContextMenuItem from "../contextMenuItem.js";
import database from "../database.js";

export default createContextMenuItem({
	type: "Message",
	data: (b) => b,
	async execute({ interaction }) {
		const authorId =
			interaction.targetMessage.author.bot && (await database.getReplacedMessage(interaction.targetMessage.id));
		if (!authorId)
			return await interaction.reply({ content: "That message isn't a replaced message!", ephemeral: true });
		if (authorId !== interaction.user.id)
			return await interaction.reply({
				content: "You don't have permission to delete that message!",
				ephemeral: true,
			});
		// database.deleteReplacedMessage() gets called by the event handler
		await interaction.targetMessage.delete();
	},
});
