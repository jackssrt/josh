import { AttachmentBuilder, Collection, GuildMember, PermissionsBitField, Role } from "discord.js";
import sharp from "sharp";
import type Command from "../command";
import { updateRoleCategories } from "../events/roleCategories.js";
import { fetchRotations, sendRegularRotations, sendSalmonRunRotation } from "../events/rotationNotifier.js";
import { colorLuminance, errorEmbeds, hexToRGB, textImage } from "../utils.js";
import { COLOR_DATA } from "./color.js";

type Subcommand = "mapsandmodesrotation" | "salmonrunrotation" | "rolecategories" | "colorrolesimage";

async function makeColorRolesImages() {
	const CELL_SIZE = [200, 100] as const;
	const COLOR_DATA_LEN_SQRT = Math.sqrt(COLOR_DATA.length);
	const IMAGE_SIZE_IN_CELLS = [Math.ceil(COLOR_DATA_LEN_SQRT), Math.floor(COLOR_DATA_LEN_SQRT)] as const;

	return await sharp({
		create: {
			width: CELL_SIZE[0] * IMAGE_SIZE_IN_CELLS[0],
			height: CELL_SIZE[1] * IMAGE_SIZE_IN_CELLS[1],
			background: "#00000000",
			channels: 4,
		},
	})
		.composite(
			await Promise.all(
				COLOR_DATA.map(async (v, i) => {
					return {
						input: await sharp({
							create: {
								width: CELL_SIZE[0],
								height: CELL_SIZE[1],
								background: `#${v.value}`,
								channels: 3,
							},
						})
							.composite([
								{
									input: await (
										await textImage(
											v.name,
											colorLuminance(...hexToRGB(`#${v.value}`)) > 255 / 2 ? "black" : "white",
											2,
										)
									).toBuffer(),
								},
							])
							.png()
							.toBuffer(),
						left: Math.floor(i / IMAGE_SIZE_IN_CELLS[1]) * CELL_SIZE[0],
						top: (i % IMAGE_SIZE_IN_CELLS[1]) * CELL_SIZE[1],
					};
				}),
			),
		)
		.png()
		.toBuffer();
}

export default {
	data: (b) =>
		b
			.addSubcommand((b) => b.setName("mapsandmodesrotation").setDescription("Rerun maps and modes rotation"))
			.addSubcommand((b) => b.setName("salmonrunrotation").setDescription("Rerun salmon run rotation"))
			.addSubcommand((b) =>
				b
					.setName("rolecategories")
					.setDescription("Rerun role categories")
					.addMentionableOption((b) => b.setName("users").setDescription("User(s)").setRequired(true)),
			)
			.addSubcommand((b) => b.setName("colorrolesimage").setDescription("Generate color roles image"))
			.setDescription("Forcefully reruns certain automatic stuff.")
			.setDMPermission(false)
			.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
	async execute({ interaction, client }) {
		if (interaction.user.id !== process.env["OWNER_ID"]!)
			return interaction.reply({ content: "This command can only be run by the developer!", ephemeral: true });
		await interaction.deferReply({ ephemeral: true });
		const subcommand = interaction.options.getSubcommand() as Subcommand;
		if (subcommand === "mapsandmodesrotation" || subcommand === "salmonrunrotation") {
			const data = await fetchRotations();
			if (!data)
				return await interaction.editReply(
					await errorEmbeds({ title: "failed to fetch rotations", description: "failed to send api call" }),
				);
			if (subcommand === "mapsandmodesrotation")
				await sendRegularRotations(client, data.endTime, data.turfWar, data.ranked, data.xBattle);
			else await sendSalmonRunRotation(client, data.salmonStartTime, data.salmonEndTime, data.salmon);
			await interaction.editReply("done");
		} else if (subcommand === "rolecategories") {
			const mentionable = interaction.options.getMentionable("users", true);
			const users =
				mentionable instanceof Role
					? mentionable.members
					: mentionable instanceof GuildMember
					? new Collection([[mentionable.id, mentionable]])
					: undefined;
			if (!users) return await interaction.editReply("no users passed in");
			await Promise.all(
				// typescript stupid moment
				(
					users.map as (
						fn: (
							value: GuildMember,
							key: string,
							collection: Collection<string, GuildMember>,
						) => Promise<void>,
					) => Promise<void>[]
				)(async (v) => await updateRoleCategories(v)),
			);
			await interaction.editReply(`done, affected ${users.size} members`);
		} else if (subcommand === "colorrolesimage") {
			await interaction.editReply({
				content: `done:`,
				files: [new AttachmentBuilder(await makeColorRolesImages()).setName("color-roles.png")],
			});
		} else {
			return await interaction.editReply("unimplemented");
		}
	},
} as Command;
