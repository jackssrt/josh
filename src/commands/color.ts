import { GuildMember } from "discord.js";
import type Command from "../command.js";
import { BOOYAH_EMOJI } from "../emojis.js";
import Lock from "../lock.js";
import { getLowerRolesInSameCategory, parallel, search } from "../utils.js";

export const COLOR_DATA = [
	{ name: "Blue Raspberry", value: "1FE2F3" },
	{ name: "Deep Sea", value: "4DBB93" },
	{ name: "Cookie Crumble", value: "DFB95F" },
	{ name: "Vecchio", value: "23F3A2" },
	{ name: "Raspberry & Cream", value: "F8CFF8" },
	{ name: "Serrulata", value: "F72CC5" },
	{ name: "Under The Sea", value: "2582F5" },
	{ name: "Lotus", value: "9DF73C" },
	{ name: "Cherry Blossom", value: "F5B2F4" },
	{ name: "Esprit", value: "00FF78" },
	{ name: "Sublime", value: "DBF741" },
	{ name: "Coral Reef", value: "22F79F" },
	{ name: "Lilac Blossom", value: "A852F8" },
	{ name: "Evening Sky", value: "4B4EB9" },
	{ name: "Sakura", value: "DE99F2" },
	{ name: "Raspberry Delight", value: "F53068" },
	{ name: "Berry Red", value: "E31D39" },
	{ name: "Crayon Orange", value: "F76138" },
	{ name: "Summer Sky", value: "676DF9" },
	{ name: "Sandstorm", value: "F8DE4D" },
	{ name: "Silver", value: "B5C9C9" },
	{ name: "Strawberry Fiesta", value: "F95B5B" },
	{ name: "Coconut Bronze", value: "A25C44" },
	{ name: "Silver Lining", value: "C8D2D2" },
	{ name: "Royal Jelly", value: "F8B637" },
	{ name: "Bloodrush", value: "B82B32" },
	{ name: "Acid Rain", value: "2CC12C" },
	{ name: "Tercero", value: "9F6730" },
	{ name: "Violeta", value: "D621F1" },
	{ name: "Emoji Green", value: "3AF547" },
	{ name: "Emoji Sky", value: "3AE6F5" },
	{ name: "Emoji Blue", value: "3A96F5" },
	{ name: "Emoji Lapis", value: "3E3AF5" },
	{ name: "Emoji Purple", value: "B13AF5" },
	{ name: "Emoji Pink", value: "F53ACB" },
	{ name: "Emoji Red", value: "F53A54" },
	{ name: "Emoji Orange", value: "F5733A" },
	{ name: "Emoji Yellow", value: "F5CB3A" },
	{ name: "Emoji Gray", value: "50535C" },
	{ name: "Emoji Silver", value: "D5DEF5" },
	{ name: "Emoji Void", value: "0D0E0F" },
	{ name: "Pastel Green", value: "98F59E" },
	{ name: "Pastel Blue Sky", value: "98EDF5" },
	{ name: "Pastel Blue", value: "98C6F5" },
	{ name: "Pastel Lavender", value: "9998F5" },
	{ name: "Pastel Purpur", value: "D398F5" },
	{ name: "Pastel Pink", value: "F598E1" },
	{ name: "Pastel Red", value: "F598A4" },
	{ name: "Pastel Orange", value: "F5B498" },
	{ name: "Pastel Yellow", value: "F5E198" },
] as const;

const colorEmojiLock = new Lock();

export default {
	data: (b) =>
		b
			.setDescription("Sets your name color")
			.addStringOption((b) =>
				b.setAutocomplete(true).setName("color").setDescription("The color").setRequired(true),
			)
			.setDMPermission(false),
	async autocomplete({ interaction }) {
		const focusedValue = interaction.options.getFocused();
		const colorDataCopy = [...COLOR_DATA];
		// slice limits the options to only be 25
		await interaction.respond(
			search(
				colorDataCopy.map((v) => v.name),
				focusedValue,
			)
				.slice(0, 25)
				.map((v) => ({ name: v, value: v })),
		);
	},
	async execute({ interaction }) {
		if (!interaction.guild || !(interaction.member instanceof GuildMember))
			return await interaction.reply("You can't run this command in a dm!");
		const colorInput = interaction.options.getString("color", true);
		const colorData = COLOR_DATA.find((a) => a.name.toLowerCase().trim() === colorInput.toLowerCase().trim());
		if (!colorData) return await interaction.reply({ content: "That color doesn't exist!", ephemeral: true });
		let key = "color-command-emoji-lock";
		const colorsCategory = (await interaction.guild.roles.fetch(process.env["COLORS_ROLE_CATEGORY_ID"]!))!;
		try {
			await parallel(interaction.deferReply(), async () => {
				key = await colorEmojiLock.lock();
				const colorRoles = await getLowerRolesInSameCategory(colorsCategory);
				const alreadyExistingRole = colorRoles.find(
					(v) => (v.hexColor.toLowerCase() as `#${string}`) === `#${colorData.value.toLowerCase()}`,
				);
				const otherColorRoles = colorRoles.filter(
					(v) => v.members.has((<GuildMember>interaction.member).id) && v.id !== alreadyExistingRole?.id,
				);
				if (otherColorRoles.length > 0)
					await (<GuildMember>interaction.member).roles.remove(
						otherColorRoles,
						"A user cannot have multiple color roles at once.",
					);
				if (alreadyExistingRole && !alreadyExistingRole.members.has((<GuildMember>interaction.member).id))
					await (<GuildMember>interaction.member).roles.add(alreadyExistingRole, "Requested color");
				if (alreadyExistingRole) return;

				// make a new role
				// and give it to the user
				const newRole = await interaction.guild!.roles.create({
					color: `#${colorData.value}`,
					hoist: false,
					mentionable: false,
					permissions: [],
					position: colorsCategory.position,
					name: `🎨・${colorData.name}`,
				});
				await (<GuildMember>interaction.member).roles.add(newRole, "Requested color");
			});
			const colorRoles = await getLowerRolesInSameCategory(colorsCategory);
			await parallel(
				interaction.editReply(`All done! Enjoy your new name color! ${BOOYAH_EMOJI}`),

				...colorRoles.map(async (v) => {
					if (v.members.size === 0 && v.id !== process.env["DEFAULT_COLOR_ROLE_ID"]!)
						await v.delete("Color role clean up");
				}),
			);
		} finally {
			colorEmojiLock.unlock(key);
		}
	},
} as Command;