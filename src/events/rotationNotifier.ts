import { TimestampStyles, time } from "discord.js";
import type Event from "../event.js";
import rotations from "../rotations/index.js";
import type { OptionalEmbedFactory } from "../utils.js";
import { embeds, parallel } from "../utils.js";
import type Client from "./../client.js";

const FUTURE_ROTATIONS_COUNT = 3;
function generateChannelTopic(): string {
	const parts = [
		`Next ${time(rotations.endTime, TimestampStyles.RelativeTime)}`,
		rotations.splatfest.active?.channelTopic(rotations.splatfest.future()[0]),
		rotations.currentFest?.state === "SECOND_HALF" && rotations.currentFest.channelTopic(undefined),
		rotations.turfWar.active?.channelTopic(rotations.turfWar.future()[0]),
		rotations.rankedSeries.active?.channelTopic(rotations.rankedSeries.future()[0]),
		rotations.rankedOpen.active?.channelTopic(rotations.rankedOpen.future()[0]),
		rotations.xBattle.active?.channelTopic(rotations.xBattle.future()[0]),
	];
	// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
	return parts.flatMap((v) => v || []).join("\n・\n");
}

export async function sendSalmonRunRotation(client: Client<true>) {
	// delete previous message
	await (await client.salmonRunChannel.messages.fetch({ limit: 1 })).first()?.delete();

	// send message
	const message = await client.salmonRunChannel.send({
		...(await embeds(
			(b) => rotations.eggstraWork.active?.embed(b),
			(b) =>
				rotations.salmonRun.active?.embed(
					b.setAuthor({ name: "Data provided by splatoon3.ink", url: "https://splatoon3.ink/" }),
				),
			...rotations.salmonRun.future(FUTURE_ROTATIONS_COUNT).map<OptionalEmbedFactory>(
				(v, i) => (b) =>
					b.setAuthor(i === 0 ? { name: "Future rotations" } : null).setDescription(
						v
							.short()
							.map((v) => v.join(" "))
							.join("\n"),
					),
			),
		)),
		files: (
			await parallel(rotations.salmonRun.active?.attachments(), rotations.eggstraWork.active?.attachments())
		).flatMap((x) => x ?? []),
	});

	// crosspost message
	await message.crosspost();
}

export async function sendRegularRotations(client: Client<true>) {
	await parallel(
		// set channel topic
		client.generalChannel.setTopic(generateChannelTopic()),

		async () => {
			// delete previous message
			await (await client.mapsChannel.messages.fetch({ limit: 1 })).first()?.delete();
			// send message
			const message = await client.mapsChannel.send({
				...(await embeds(
					(b) =>
						b
							.setAuthor({ name: "Data provided by splatoon3.ink", url: "https://splatoon3.ink/" })
							.setDescription(
								`Ends ${time(rotations.endTime, TimestampStyles.RelativeTime)} ${time(
									rotations.endTime,
									TimestampStyles.ShortTime,
								)}`,
							),
					(b) => rotations.splatfest.active?.embed(b, rotations.splatfest.future(FUTURE_ROTATIONS_COUNT)),
					(b) => rotations.currentFest?.state === "SECOND_HALF" && rotations.currentFest.embed(b, []),
					(b) => rotations.challenges.active?.embed(b, []),
					(b) => rotations.turfWar.active?.embed(b, rotations.turfWar.future(FUTURE_ROTATIONS_COUNT)),
					(b) =>
						rotations.rankedSeries.active?.embed(b, rotations.rankedSeries.future(FUTURE_ROTATIONS_COUNT)),
					(b) => rotations.rankedOpen.active?.embed(b, rotations.rankedOpen.future(FUTURE_ROTATIONS_COUNT)),
					(b) => rotations.xBattle.active?.embed(b, rotations.xBattle.future(FUTURE_ROTATIONS_COUNT)),
				)),
				files: (
					await parallel(
						rotations.splatfest.active?.attachments(),
						rotations.currentFest?.attachments(),
						rotations.challenges.active?.attachments(),
						rotations.turfWar.active?.attachments(),
						rotations.rankedOpen.active?.attachments(),
						rotations.rankedSeries.active?.attachments(),
						rotations.xBattle.active?.attachments(),
					)
				).flatMap((x) => x ?? []),
			});
			// crosspost message
			await message.crosspost();
		},
	);
}

export default {
	event: "ready",
	on({ client }) {
		rotations.hook(async () => await sendRegularRotations(client));
		rotations.hookSalmon(async () => await sendSalmonRunRotation(client));
	},
} as Event<"ready">;
