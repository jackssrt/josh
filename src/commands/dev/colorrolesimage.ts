import createSubcommand from "@/commandHandler/subcommand.js";
import { COLOR_DATA } from "@/commands/color.js";
import { colorLuminance, hexToRGB } from "@/utils/color.js";
import { textImage } from "@/utils/image.js";
import { parallel } from "@/utils/promise.js";
import { AttachmentBuilder } from "discord.js";
import sharp from "sharp";
import { finish } from "./index.js";

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

export default createSubcommand({
	data: (b) => b.setDescription("Generate color roles image"),
	defer: "ephemeral",
	async execute({ interaction }) {
		await finish(interaction, {
			files: [new AttachmentBuilder(await makeColorRolesImage()).setName("color-roles.png")],
		});
	},
});
