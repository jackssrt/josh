import { GuildMember } from "discord.js";
import { z } from "zod";
import createContextMenuItem from "../contextMenuItem.js";
import { reportError } from "../errorhandler.js";
import { request } from "../utils/http.js";
import { pawait } from "../utils/result.js";

/**
 * @link https://github.com/Vendicated/Vencord/tree/main/src/plugins/translate
 */
const LANGUAGES: Record<string, string> = {
	auto: "Detect language",
	af: "Afrikaans",
	sq: "Albanian",
	am: "Amharic",
	ar: "Arabic",
	hy: "Armenian",
	as: "Assamese",
	ay: "Aymara",
	az: "Azerbaijani",
	bm: "Bambara",
	eu: "Basque",
	be: "Belarusian",
	bn: "Bengali",
	bho: "Bhojpuri",
	bs: "Bosnian",
	bg: "Bulgarian",
	ca: "Catalan",
	ceb: "Cebuano",
	ny: "Chichewa",
	"zh-CN": "Chinese (Simplified)",
	"zh-TW": "Chinese (Traditional)",
	co: "Corsican",
	hr: "Croatian",
	cs: "Czech",
	da: "Danish",
	dv: "Dhivehi",
	doi: "Dogri",
	nl: "Dutch",
	en: "English",
	eo: "Esperanto",
	et: "Estonian",
	ee: "Ewe",
	tl: "Filipino",
	fi: "Finnish",
	fr: "French",
	fy: "Frisian",
	gl: "Galician",
	ka: "Georgian",
	de: "German",
	el: "Greek",
	gn: "Guarani",
	gu: "Gujarati",
	ht: "Haitian Creole",
	ha: "Hausa",
	haw: "Hawaiian",
	iw: "Hebrew",
	hi: "Hindi",
	hmn: "Hmong",
	hu: "Hungarian",
	is: "Icelandic",
	ig: "Igbo",
	ilo: "Ilocano",
	id: "Indonesian",
	ga: "Irish",
	it: "Italian",
	ja: "Japanese",
	jw: "Javanese",
	kn: "Kannada",
	kk: "Kazakh",
	km: "Khmer",
	rw: "Kinyarwanda",
	gom: "Konkani",
	ko: "Korean",
	kri: "Krio",
	ku: "Kurdish (Kurmanji)",
	ckb: "Kurdish (Sorani)",
	ky: "Kyrgyz",
	lo: "Lao",
	la: "Latin",
	lv: "Latvian",
	ln: "Lingala",
	lt: "Lithuanian",
	lg: "Luganda",
	lb: "Luxembourgish",
	mk: "Macedonian",
	mai: "Maithili",
	mg: "Malagasy",
	ms: "Malay",
	ml: "Malayalam",
	mt: "Maltese",
	mi: "Maori",
	mr: "Marathi",
	"mni-Mtei": "Meiteilon (Manipuri)",
	lus: "Mizo",
	mn: "Mongolian",
	my: "Myanmar (Burmese)",
	ne: "Nepali",
	no: "Norwegian",
	or: "Odia (Oriya)",
	om: "Oromo",
	ps: "Pashto",
	fa: "Persian",
	pl: "Polish",
	pt: "Portuguese",
	pa: "Punjabi",
	qu: "Quechua",
	ro: "Romanian",
	ru: "Russian",
	sm: "Samoan",
	sa: "Sanskrit",
	gd: "Scots Gaelic",
	nso: "Sepedi",
	sr: "Serbian",
	st: "Sesotho",
	sn: "Shona",
	sd: "Sindhi",
	si: "Sinhala",
	sk: "Slovak",
	sl: "Slovenian",
	so: "Somali",
	es: "Spanish",
	su: "Sundanese",
	sw: "Swahili",
	sv: "Swedish",
	tg: "Tajik",
	ta: "Tamil",
	tt: "Tatar",
	te: "Telugu",
	th: "Thai",
	ti: "Tigrinya",
	ts: "Tsonga",
	tr: "Turkish",
	tk: "Turkmen",
	ak: "Twi",
	uk: "Ukrainian",
	ur: "Urdu",
	ug: "Uyghur",
	uz: "Uzbek",
	vi: "Vietnamese",
	cy: "Welsh",
	xh: "Xhosa",
	yi: "Yiddish",
	yo: "Yoruba",
	zu: "Zulu",
};

const translationApiReturnSchema = z.object({
	src: z.string(),
	sentences: z.array(z.object({ trans: z.string() })),
});

/**
 * @link https://github.com/Vendicated/Vencord/blob/7e395fc6968aced5d45fae55db646def1d555c49/src/plugins/translate/utils.ts#L38
 */
async function translate(text: string, outLang = "en") {
	const res = (
		await request(
			`https://translate.googleapis.com/translate_a/single?${new URLSearchParams({
				client: "gtx",
				sl: "auto",
				tl: outLang,
				dt: "t",
				dj: "1",
				source: "input",
				q: text,
			}).toString()}`,
		)
	).expect("Translation request failed");

	const validationResult = translationApiReturnSchema.safeParse(res);
	if (!validationResult.success) {
		throw new Error("Failed to validate translation api response");
	}
	return [
		LANGUAGES[validationResult.data.src] ?? validationResult.data.src,
		validationResult.data.sentences.map((v) => v.trans).join(""),
	] as const;
}

export default createContextMenuItem({
	type: "Message",
	data: (b) => b,
	async execute({ interaction }) {
		const content = interaction.targetMessage.content;
		const translated = await pawait(translate(content));
		if (translated.isErr()) {
			reportError({
				title: "Translation failed",
				error: translated.error,
				interaction,
				affectedUser: interaction.member instanceof GuildMember ? interaction.member : interaction.user,
			});
			return;
		}
		await interaction.reply({ content: `"${translated.value[1]}" (${translated.value[0]})`, ephemeral: true });
	},
});
