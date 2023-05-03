import type Command from "../command.js";
import type { RotationTypeToNodeType } from "../events/rotationNotifier.js";
import {
	fetchRotations,
	makeCompactRotationText,
	makeCompactSalmonRunRotationText,
} from "../events/rotationNotifier.js";
import type { RotationType } from "../maps.js";
import { GAME_MODE_MAP, ROTATION_TYPE_MAP } from "../maps.js";
import type { BankaraNode, BaseNode, RankedVsRule, XNode } from "../types/rotationNotifier.js";
import { dedent, embeds, errorEmbeds } from "../utils.js";
type ListSubcommand = "turfwar" | "anarchyseries" | "anarchyopen" | "xbattle" | "splatfest" | "salmonrun";
const SUBCOMMAND_GAMEMODE_MAP = {
	splatzones: "AREA",
	towercontrol: "LOFT",
	clamblitz: "CLAM",
	rainmaker: "GOAL",
} as const satisfies Record<string, RankedVsRule["rule"]>;
type SearchSubcommand = keyof typeof SUBCOMMAND_GAMEMODE_MAP;

let lastData: Awaited<ReturnType<typeof fetchRotations>> | undefined = undefined;

export default {
	data: (b) => {
		b.addSubcommandGroup((b) => {
			b.setName("list").setDescription("Lists future rotations");
			Object.keys(ROTATION_TYPE_MAP).forEach((key) =>
				b.addSubcommand((b) => b.setName(key).setDescription(`Shows future ${key} rotations`)),
			);
			return b.addSubcommand((b) => b.setName("salmonrun").setDescription("Shows future Salmon Run rotations"));
		});
		b.addSubcommandGroup((b) => {
			b.setName("search").setDescription("Searches through future rotations for a specific gamemode.");
			Object.keys(SUBCOMMAND_GAMEMODE_MAP).forEach((key) =>
				b.addSubcommand((b) => b.setName(key).setDescription(`Searches through future ${key} rotations`)),
			);
			return b;
		});
		return b.setDescription("Shows future rotations");
	},
	defer: "standard",

	async execute({ interaction }) {
		if (!lastData?.turfWar[0] || new Date(Date.parse(lastData.turfWar[0].endTime)) < new Date())
			// fetch new rotations
			lastData = await fetchRotations();
		if (!lastData)
			return await interaction.editReply({
				...(await errorEmbeds({ title: "Failed to fetch rotations", description: "Try again in a bit..." })),
			});
		const subcommandGroup = interaction.options.getSubcommandGroup() as "list" | "search";
		if (subcommandGroup === "list") {
			const rotationType = interaction.options.getSubcommand() as ListSubcommand;

			if (rotationType === "salmonrun") {
				await interaction.editReply(
					await embeds((b) =>
						b
							.setTitle("Future Salmon Run rotations")
							.setDescription(
								lastData!.salmon.reduce(
									(acc, v) => dedent`${acc}

							➔ ${makeCompactSalmonRunRotationText(v)}`,
									"",
								),
							)
							.setColor("#ff5033"),
					),
				);
			} else {
				const { emoji, color } = ROTATION_TYPE_MAP[rotationType];
				await interaction.editReply(
					await embeds((b) =>
						b
							.setTitle(`${emoji} Future ${rotationType} rotations`)
							.setDescription(
								(
									(
										{
											anarchyopen: lastData!.ranked,
											anarchyseries: lastData!.ranked,
											splatfest: lastData!.splatfest,
											tricolor: lastData!.splatfest,
											turfwar: lastData!.turfWar,
											xbattle: lastData!.xBattle,
										} as const satisfies Record<RotationType, BaseNode[]>
									)[rotationType] as RotationTypeToNodeType<typeof rotationType>[]
								)
									.reduce((acc, v) => {
										return dedent`${acc}
											➔ ${makeCompactRotationText(rotationType, v, true)}`;
									}, "")
									.trimStart(),
							)
							.setColor(color),
					),
				);
			}
		} else {
			const subcommand = interaction.options.getSubcommand() as SearchSubcommand;
			const gamemode = SUBCOMMAND_GAMEMODE_MAP[subcommand];
			const { name, color } = GAME_MODE_MAP[SUBCOMMAND_GAMEMODE_MAP[subcommand]];
			// typescript stupid moment
			const matched = [
				lastData.ranked.filter((v) => v.bankaraMatchSettings?.[0].vsRule.rule === gamemode),
				lastData.ranked.filter((v) => v.bankaraMatchSettings?.[1].vsRule.rule === gamemode),
				lastData.xBattle.filter((v) => v.xMatchSetting?.vsRule.rule === gamemode),
			];
			if (matched.length === 0 || matched.find((v) => v.length === 0) !== undefined) {
				return await interaction.editReply(
					await errorEmbeds({ title: "Couldn't find gamemode", description: "Try again later..." }),
				);
			}
			await interaction.editReply(
				await embeds((b) =>
					b
						.setTitle(`Future ${name} rotations`)
						.setColor(color)
						.addFields(
							matched.map((v, i) => {
								const rotationType = i === 0 ? "anarchyseries" : i === 1 ? "anarchyopen" : "xbattle";
								const { emoji, name } = ROTATION_TYPE_MAP[rotationType];
								return {
									name: `${emoji} ${name}`,
									value: (v as (BankaraNode | XNode)[]).reduce(
										(acc, v) => `${acc}\n➔ ${makeCompactRotationText(rotationType, v, true) ?? ""}`,
										"",
									),
								};
							}),
						),
				),
			);
		}
	},
} as Command;
