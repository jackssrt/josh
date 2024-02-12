import createCommand from "@/commandHandler/command.js";

export default createCommand({
	data: (b) => b.setDescription("Sets certain roleplay stuff"),
	userAllowList: process.env.ROLEPLAYER_IDS.split(","),
});
