import { BOOYAH_EMOJI } from "../emojis.js";
import Lock from "../lock.js";
import type { Result } from "../utils.js";
import { getLowerRolesInSameCategory, parallel, search } from "../utils.js";
import createCommand from "./../command.js";

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

function parseHex(color: string): Result<string> {
	// Remove the leading '#' if present
	if (color.startsWith("#")) color = color.slice(1);

	// Check if the hexColor string is valid
	if (!/^[0-9A-Fa-f]{3}$|^[0-9A-Fa-f]{6}$/.test(color)) return [undefined, new Error("Invalid hex color string")];

	// Expand the short-hand color notation (e.g., #abc to #aabbcc)
	if (color.length === 3) color = color.replace(/(.)/g, "$1$1");

	return [color, undefined];
}

const colorEmojiLock = new Lock();

export default createCommand({
	data: (b) =>
		b
			.setDescription("Sets your name color")
			.addStringOption((b) =>
				b
					.setName("color")
					.setAutocomplete(true)
					.setDescription(
						`The color name or hex value, ex: "${COLOR_DATA[0].name.toLowerCase()}" or "${COLOR_DATA[0].value.toLowerCase()}"`,
					)
					.setRequired(true),
			)
			.setDMPermission(false),
	async autocomplete({ interaction }) {
		const focusedValue = interaction.options.getFocused();
		// slice limits the options to only be 25
		const [hex] = parseHex(focusedValue);
		await interaction.respond([
			...(hex ? [{ name: focusedValue, value: focusedValue }] : []),
			...search(
				COLOR_DATA.map((v) => v.name),
				focusedValue,
			)
				.slice(0, hex ? 24 : 25)
				.map((v) => ({ name: v, value: v })),
		]);
	},

	async execute({ client, interaction }) {
		if (!interaction.inCachedGuild() || interaction.guild !== client.guild)
			return await interaction.reply("You can't run this command here!");
		const input = interaction.options.getString("color", true).trim().toLowerCase();
		const [colorInput] = parseHex(input);
		const colorData = COLOR_DATA.find(
			(v) => v.value.toLowerCase() === colorInput?.toLowerCase() || v.name.toLowerCase() === input.toLowerCase(),
		);

		const hexColor = (colorInput || colorData?.value)?.toLowerCase();
		if (!hexColor) return await interaction.reply("Provide a valid color name or hex value!");

		let key = "color-command-emoji-lock";
		try {
			await parallel(interaction.deferReply(), async () => {
				key = await colorEmojiLock.lock();
				const colorRoles = await getLowerRolesInSameCategory(client.colorsRoleCategory);
				const alreadyExistingRole = colorRoles.find(
					(v) => (v.hexColor.toLowerCase() as `#${string}`) === `#${hexColor}`,
				);
				const otherColorRoles = colorRoles.filter(
					(v) => v.members.has(interaction.member.id) && v.id !== alreadyExistingRole?.id,
				);
				if (otherColorRoles.length > 0)
					await interaction.member.roles.remove(
						otherColorRoles,
						"A user cannot have multiple color roles at once.",
					);
				if (alreadyExistingRole && !alreadyExistingRole.members.has(interaction.member.id))
					await interaction.member.roles.add(alreadyExistingRole, "Requested color");
				if (alreadyExistingRole) return;

				// make a new role
				// and give it to the user
				const newRole = await client.guild.roles.create({
					color: `#${hexColor}`,
					hoist: false,
					mentionable: false,
					permissions: [],
					position: client.colorsRoleCategory.position,
					name: `🎨・${colorData?.name ?? "Custom"}`,
				});
				await interaction.member.roles.add(newRole, "Requested color");
			});
			const colorRoles = await getLowerRolesInSameCategory(client.colorsRoleCategory);
			await parallel(
				interaction.editReply(`All done! Enjoy your new name color! ${BOOYAH_EMOJI}`),

				...colorRoles.map(async (v) => {
					if (v.members.size === 0 && v.id !== process.env.DEFAULT_COLOR_ROLE_ID)
						await v.delete("Color role clean up");
				}),
			);
		} finally {
			colorEmojiLock.unlock(key);
		}
	},
});
