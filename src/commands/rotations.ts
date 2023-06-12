import type Command from "../command.js";
import type { PoppingTimeRangeCollection } from "../rotations/TimeRangeCollection.js";
import rotations from "../rotations/index.js";
import type { BaseNode } from "../rotations/nodes.js";
import type { RankedRule } from "../rotations/rules.js";
import { RULE_MAP } from "../rotations/rules.js";
import { embeds, errorEmbeds } from "../utils.js";
const listSubcommands = [
	"challenges",
	"turfwar",
	"anarchyseries",
	"anarchyopen",
	"xbattle",
	"splatfest",
	"salmonrun",
] as const;
type ListSubcommand = (typeof listSubcommands)[number];

const SUBCOMMAND_GAMEMODE_MAP = {
	splatzones: "AREA",
	towercontrol: "LOFT",
	clamblitz: "CLAM",
	rainmaker: "GOAL",
} as const satisfies Record<string, RankedRule["rule"]>;

type SearchSubcommand = keyof typeof SUBCOMMAND_GAMEMODE_MAP;

export default {
	data: (b) => {
		b.addSubcommandGroup((b) => {
			b.setName("list").setDescription("Lists future rotations");
			listSubcommands.forEach((key) =>
				b.addSubcommand((b) => b.setName(key).setDescription(`Shows future ${key} rotations`)),
			);
			return b;
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
		const subcommandGroup = interaction.options.getSubcommandGroup() as "list" | "search";
		if (subcommandGroup === "list") {
			const rotationType = interaction.options.getSubcommand() as ListSubcommand;

			if (rotationType === "salmonrun") {
				await interaction.editReply(
					await embeds((b) =>
						b
							.setTitle("Future Salmon Run rotations")
							.setDescription(rotations.salmonRun.ranges.map((v) => v.short()).join("\n"))
							.setColor("#ff5033"),
					),
				);
			} else {
				const subcommandMap = {
					anarchyopen: rotations.rankedOpen,
					anarchyseries: rotations.rankedSeries,
					splatfest: rotations.splatfest,
					turfwar: rotations.turfWar,
					challenges: rotations.challenges,
					xbattle: rotations.xBattle,
					salmonrun: rotations.salmonRun,
				} as const satisfies Record<ListSubcommand, PoppingTimeRangeCollection<BaseNode | undefined>>;
				const nodes = subcommandMap[interaction.options.getSubcommand(true) as ListSubcommand];
				const displayNode = (nodes as PoppingTimeRangeCollection<BaseNode | undefined>).ranges.find((v) => !!v);
				if (!displayNode)
					return await interaction.editReply(
						await errorEmbeds({ title: "Couldn't find rotation type", description: "Try again later..." }),
					);
				await interaction.editReply(
					await embeds((b) =>
						b
							.setTitle(`${displayNode.emoji} Future ${displayNode.name} rotations`)
							.setDescription(
								nodes.ranges.flatMap((v) => (v ? v.short({ showDate: true }) : [])).join("\n"),
							)
							.setColor(displayNode.color),
					),
				);
			}
		} else {
			const subcommand = interaction.options.getSubcommand() as SearchSubcommand;
			const gamemode = SUBCOMMAND_GAMEMODE_MAP[subcommand];
			const matched = [
				rotations.challenges.ranges.filter((v) => v?.rule.rule === gamemode),
				rotations.rankedSeries.ranges.filter((v) => v?.rule.rule === gamemode),
				rotations.rankedOpen.ranges.filter((v) => v?.rule.rule === gamemode),
				rotations.xBattle.ranges.filter((v) => v?.rule.rule === gamemode),
			] as const;
			if (matched.every((v) => v.length === 0))
				return await interaction.editReply(
					await errorEmbeds({ title: "Couldn't find gamemode", description: "Try again later..." }),
				);

			const rule = RULE_MAP[gamemode];
			await interaction.editReply(
				await embeds((b) =>
					b
						.setTitle(`Future ${rule.name} rotations`)
						.setColor(rule.color)
						.addFields(
							matched.flatMap((v) =>
								v[0]
									? {
											name: `${v[0].emoji} ${v[0].name}`,
											value: v.flatMap((x) => (x ? x.short({ showDate: true }) : [])).join("\n"),
									  }
									: [],
							),
						),
				),
			);
		}
	},
} as Command;
