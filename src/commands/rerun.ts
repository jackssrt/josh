import { AttachmentBuilder, Collection, GuildMember, PermissionsBitField, Role } from "discord.js";
import sharp from "sharp";
import type Command from "../command";
import { onMemberJoin, onMemberLeave } from "../events/joinLeaveMessage.js";
import { updateRoleCategories } from "../events/roleCategories.js";
import { fetchRotations, sendRegularRotations, sendSalmonRunRotation } from "../events/rotationNotifier.js";
import { colorLuminance, errorEmbeds, hexToRGB, parallel, textImage } from "../utils.js";
import { COLOR_DATA } from "./color.js";

type Subcommand =
	| "mapsandmodesrotation"
	| "salmonrunrotation"
	| "rolecategories"
	| "colorrolesimage"
	| "memberjoin"
	| "memberleave";

async function makeColorRolesImage() {
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
			await parallel(
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
			.addSubcommand((b) =>
				b
					.setName("memberjoin")
					.setDescription("Rerun member join")
					.addUserOption((b) => b.setName("member").setDescription("member").setRequired(true)),
			)
			.addSubcommand((b) =>
				b
					.setName("memberleave")
					.setDescription("Rerun member leave")
					.addUserOption((b) => b.setName("member").setDescription("member").setRequired(true)),
			)
			.setDescription("Forcefully reruns certain automatic stuff.")
			.setDMPermission(false)
			.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
	ownerOnly: true,
	defer: "ephemeral",
	async execute({ interaction, client }) {
		const subcommand = interaction.options.getSubcommand() as Subcommand;
		if (subcommand === "mapsandmodesrotation" || subcommand === "salmonrunrotation") {
			const data = await fetchRotations();
			if (!data)
				return await interaction.editReply(
					await errorEmbeds({ title: "failed to fetch rotations", description: "failed to send api call" }),
				);
			if (subcommand === "mapsandmodesrotation")
				await sendRegularRotations(
					client,
					data.endTime,
					data.currentFest?.state === "SECOND_HALF" ? data.currentFest : undefined,
					data.splatfest,
					data.turfWar,
					data.ranked,
					data.xBattle,
				);
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
			await parallel(
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
				files: [new AttachmentBuilder(await makeColorRolesImage()).setName("color-roles.png")],
			});
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		} else if (subcommand === "memberjoin" || subcommand === "memberleave") {
			const member = interaction.options.getMember("member");
			if (!(member instanceof GuildMember)) return;
			if (subcommand === "memberjoin") await onMemberJoin(client, member);
			else await onMemberLeave(client, member);
			await interaction.editReply("done");
		} else {
			return await interaction.editReply("unimplemented");
		}
	},
} as Command;
