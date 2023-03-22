import type Command from "../command.js";
import type { RotationType, RotationTypeToNodeType } from "../events/rotationNotifier.js";
import {
	MAPSNMODES_EMBED_DATA_MAP,
	fetchRotations,
	makeCompactRotationText,
	makeCompactSalmonRunRotationText,
} from "../events/rotationNotifier.js";
import { dedent, embeds, errorEmbeds } from "../utils.js";
type Subcommand = "turfwar" | "anarchyseries" | "anarchyopen" | "xbattle" | "splatfest" | "salmonrun";
const SUBCOMMAND_ROTATIONTYPE_MAP = {
	anarchyopen: "Anarchy Open",
	anarchyseries: "Anarchy Series",
	splatfest: "Splatfest",
	turfwar: "Turf War",
	xbattle: "X Battle",
} as const satisfies Record<Exclude<Subcommand, "salmonrun">, Exclude<RotationType, "Tricolor">>;
let lastData: Awaited<ReturnType<typeof fetchRotations>> | undefined = undefined;

export default {
	data: (b) => {
		Object.entries(SUBCOMMAND_ROTATIONTYPE_MAP).forEach(([key, val]) => {
			b.addSubcommand((b) => b.setName(key).setDescription(`Shows future ${val} rotations`));
		});
		b.addSubcommand((b) => b.setName("salmonrun").setDescription("Shows future Salmon Run rotations"));
		return b.setDescription("Shows future rotations");
	},
	defer: "standard",

	async execute({ interaction }) {
		const subcommand = interaction.options.getSubcommand() as Subcommand;

		if (!lastData?.turfWar[0] || new Date(Date.parse(lastData.turfWar[0].endTime)) < new Date())
			// fetch new rotations
			lastData = await fetchRotations();
		if (!lastData)
			return await interaction.editReply({
				...(await errorEmbeds({ title: "Failed to fetch rotations", description: "Try again in a bit..." })),
			});
		const ROTATIONTYPE_NODE_MAP = {
			"Turf War": lastData.turfWar,
			"Anarchy Open": lastData.ranked,
			"Anarchy Series": lastData.ranked,
			"X Battle": lastData.xBattle,
			Splatfest: lastData.splatfest,
		} as const satisfies { [K in Exclude<RotationType, "Tricolor">]: RotationTypeToNodeType<K>[] };
		const rotationType = (
			SUBCOMMAND_ROTATIONTYPE_MAP as Record<Subcommand, Exclude<RotationType, "Tricolor"> | undefined>
		)[subcommand];
		if (rotationType) {
			const { emoji, color } = MAPSNMODES_EMBED_DATA_MAP[rotationType];
			await interaction.editReply(
				await embeds((b) =>
					b
						.setTitle(`${emoji} Future ${rotationType} rotations`)
						.setDescription(
							// type assertion here to make array writable
							(ROTATIONTYPE_NODE_MAP[rotationType] as RotationTypeToNodeType<typeof rotationType>[])
								.reduce((acc, v) => {
									return dedent`${acc}
											➔ ${makeCompactRotationText(rotationType, v, true)}`;
								}, "")
								.trimStart(),
						)
						.setColor(color),
				),
			);
		} else {
			await interaction.editReply(
				await embeds((b) =>
					b.setTitle("Future Salmon Run rotations").setDescription(
						lastData!.salmon.reduce(
							(acc, v) => dedent`${acc}

							➔ ${makeCompactSalmonRunRotationText(v)}`,
							"",
						),
					),
				),
			);
		}
	},
} as Command;
