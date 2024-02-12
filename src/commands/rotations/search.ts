import createSubcommand from "@/commandHandler/subcommand.js";
import rotations from "@/rotations/index.js";
import { RULE_MAP, type RankedRule } from "@/rotations/rules.js";
import { embeds } from "@/utils/discord/embeds.js";

const GAMEMODE_MAP = {
	splatzones: "AREA",
	towercontrol: "LOFT",
	clamblitz: "CLAM",
	rainmaker: "GOAL",
} as const satisfies Record<string, RankedRule["rule"]>;

export default createSubcommand({
	data: (b) =>
		b.setDescription("Searches through rotations for a specific gamemode").addStringOption((b) =>
			b
				.setName("gamemode")
				.setDescription("The gamemode to search for")
				.addChoices(...Object.keys(GAMEMODE_MAP).map((v) => ({ name: v, value: v })))
				.setRequired(true),
		),
	async execute({ interaction }) {
		const gamemode = GAMEMODE_MAP[interaction.options.getString("gamemode", true) as keyof typeof GAMEMODE_MAP];
		/* eslint-disable @typescript-eslint/no-unnecessary-condition */
		const matched = [
			rotations.challenges.periods.filter((v) => v?.rule?.rule === gamemode),
			rotations.rankedSeries.periods.filter((v) => v?.rule?.rule === gamemode),
			rotations.rankedOpen.periods.filter((v) => v?.rule?.rule === gamemode),
			rotations.xBattle.periods.filter((v) => v?.rule?.rule === gamemode),
		] as const;
		/* eslint-enable @typescript-eslint/no-unnecessary-condition */

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
	},
});
