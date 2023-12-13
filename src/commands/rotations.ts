import { match } from "ts-pattern";
import type { PoppingTimePeriodCollection } from "../rotations/TimePeriodCollection.js";
import rotations from "../rotations/index.js";
import type { BaseNode } from "../rotations/nodes.js";
import type { RankedRule } from "../rotations/rules.js";
import { RULE_MAP } from "../rotations/rules.js";
import { embeds } from "../utils.js";
import createCommand from "./../command.js";
const listSubcommands = [
	"challenges",
	"turfwar",
	"anarchyseries",
	"anarchyopen",
	"xbattle",
	"splatfestopen",
	"splatfestpro",
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

export default createCommand({
	data: (b) => {
		b.addSubcommandGroup((b) => {
			b.setName("list").setDescription("Lists rotations");
			listSubcommands.forEach((key) =>
				b.addSubcommand((b) => b.setName(key).setDescription(`Shows ${key} rotations`)),
			);
			return b;
		});
		b.addSubcommandGroup((b) => {
			b.setName("search").setDescription("Searches through rotations for a specific gamemode.");
			Object.keys(SUBCOMMAND_GAMEMODE_MAP).forEach((key) =>
				b.addSubcommand((b) => b.setName(key).setDescription(`Searches through ${key} rotations`)),
			);
			return b;
		});
		return b.setDescription("Shows rotations");
	},
	async execute({ interaction }) {
		const subcommandGroup = interaction.options.getSubcommandGroup() as "list" | "search";
		if (subcommandGroup === "list") {
			const subcommand = interaction.options.getSubcommand(true) as ListSubcommand;

			const nodes = match(subcommand)
				.with("splatfestpro", () => rotations.splatfestPro)
				.with("splatfestopen", () => rotations.splatfestOpen)
				.with("challenges", () => rotations.challenges)
				.with("turfwar", () => rotations.turfWar)
				.with("anarchyopen", () => rotations.rankedOpen)
				.with("anarchyseries", () => rotations.rankedSeries)
				.with("xbattle", () => rotations.xBattle)
				.with("salmonrun", () => rotations.salmonRun)
				.exhaustive();
			const displayNode = (nodes as PoppingTimePeriodCollection<BaseNode | undefined>).periods.find((v) => !!v);
			if (!displayNode) throw new Error("Couldn't find rotation type, try again later...");
			await interaction.editReply(
				await embeds((b) =>
					b
						.setTitle(`${displayNode.emoji} ${displayNode.name} rotations`)
						.setDescription(
							nodes.periods
								.flatMap((v) =>
									v
										? v
												.short({ showDate: true })
												.map((v) => v.join(" "))
												.join("\n")
										: [],
								)
								.join(subcommand === "salmonrun" ? "\n\n" : "\n"),
						)
						.setColor(displayNode.color),
				),
			);
		} else {
			const subcommand = interaction.options.getSubcommand() as SearchSubcommand;
			const gamemode = SUBCOMMAND_GAMEMODE_MAP[subcommand];
			const matched = [
				rotations.challenges.periods.filter((v) => v?.rule.rule === gamemode),
				rotations.rankedSeries.periods.filter((v) => v?.rule.rule === gamemode),
				rotations.rankedOpen.periods.filter((v) => v?.rule.rule === gamemode),
				rotations.xBattle.periods.filter((v) => v?.rule.rule === gamemode),
			] as const;
			if (matched.every((v) => v.length === 0)) throw new Error("Couldn't find gamemode, try again later...");

			const rule = RULE_MAP[gamemode];
			await interaction.editReply(
				await embeds((b) =>
					b
						.setTitle(`${rule.name} rotations`)
						.setColor(rule.color)
						.addFields(
							matched.flatMap((v) =>
								v[0]
									? {
											name: `${v[0].emoji} ${v[0].name}`,
											value: v
												.flatMap((x) =>
													x
														? x
																.short({ showDate: true })
																.map((v) => v.join(" "))
																.join("\n")
														: [],
												)
												.join("\n"),
										}
									: [],
							),
						),
				),
			);
		}
	},
});
