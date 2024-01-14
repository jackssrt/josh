import database from "../database.js";
import createEvent from "./../event.js";

export default createEvent({
	event: "messageDelete",
	async on(_, message) {
		if (message.author && !message.author.bot) return;
		await database.deleteReplacedMessage(message.id);
	},
});
