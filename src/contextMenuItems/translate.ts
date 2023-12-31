import axios from "axios";
import { GuildMember } from "discord.js";
import createContextMenuItem from "../contextMenuItem.js";
import { pawait, reportError } from "../utils.js";

type TranslationApiReturn = {
	src: string;
	sentences: { trans: string }[];
};

/**
 * @link https://github.com/Vendicated/Vencord/blob/7e395fc6968aced5d45fae55db646def1d555c49/src/plugins/translate/utils.ts#L38
 */
async function translate(text: string, outLang = "en") {
	const res = await pawait(
		axios.get<TranslationApiReturn>(
			`https://translate.googleapis.com/translate_a/single?${new URLSearchParams({
				client: "gtx",
				sl: "auto",
				tl: outLang,
				dt: "t",
				dj: "1",
				source: "input",
				q: text,
			}).toString()}`,
		),
	);
	return res.map((v) => v.data.sentences.map((v) => v.trans).join(""));
}

export default createContextMenuItem({
	type: "Message",
	data: (b) => b,
	async execute({ interaction }) {
		const content = interaction.targetMessage.content;
		const translated = await translate(content);
		if (translated.isErr()) {
			reportError({
				title: "Translation failed",
				error: translated.error,
				interaction,
				affectedUser: interaction.member instanceof GuildMember ? interaction.member : interaction.user,
			});
			return;
		}
		await interaction.reply({ content: `"${translated.value}"`, ephemeral: true });
	},
});
