import createSubcommand from "@/commandHandler/subcommand.js";
import type { PoppingTimePeriodCollection } from "@/rotations/TimePeriodCollection.js";
import rotations from "@/rotations/index.js";
import type { BaseNode } from "@/rotations/nodes.js";
import { embeds } from "@/utils/discord/embeds.js";
import type { APIApplicationCommandOptionChoice } from "discord.js";
import { match } from "ts-pattern";

const rotationTypes = [
	"challenges",
	"turfwar",
	"anarchyseries",
	"anarchyopen",
	"xbattle",
	"splatfestopen",
	"splatfestpro",
	"salmonrun",
] as const;
type RotationType = (typeof rotationTypes)[number];

export default createSubcommand({
	data: (b) =>
		b.setDescription("Lists rotations").addStringOption((b) =>
			b
				.setName("rotationtype")
				.setDescription("The rotation type to list")
				.addChoices(
					...rotationTypes.map<APIApplicationCommandOptionChoice<string>>((v) => ({ name: v, value: v })),
				)
				.setRequired(true),
		),
	async execute({ interaction }) {
		const rotationType = interaction.options.getString("rotationtype", true) as RotationType;
		const nodes = match(rotationType)
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
		await interaction.reply(
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
							.join(rotationType === "salmonrun" ? "\n\n" : "\n"),
					)
					.setColor(displayNode.color),
			),
		);
	},
});
