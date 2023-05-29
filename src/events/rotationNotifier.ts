import type { Client, NewsChannel, TextChannel } from "discord.js";
import { TimestampStyles, time } from "discord.js";
import getEnv from "../env.js";
import type Event from "../event.js";
import rotations from "../rotations/index.js";
import type { OptionalEmbedFactory } from "../utils.js";
import { embeds, parallel } from "../utils.js";

const FUTURE_ROTATIONS_COUNT = 3;
function generateChannelTopic(): string {
	const parts = [
		`Next ${time(rotations.endTime, TimestampStyles.RelativeTime)}`,
		rotations.splatfest[0]?.channelTopic(rotations.splatfest[1]),
		rotations.currentFest?.state === "SECOND_HALF" && rotations.currentFest.channelTopic(undefined),
		rotations.turfWar[0]?.channelTopic(rotations.turfWar[1]),
		rotations.rankedSeries[0]?.channelTopic(rotations.rankedSeries[1]),
		rotations.rankedOpen[0]?.channelTopic(rotations.rankedOpen[1]),
		rotations.xBattle[0]?.channelTopic(rotations.xBattle[1]),
	];
	// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
	return parts.flatMap((v) => v || []).join("\n・\n");
}

export async function sendSalmonRunRotation(client: Client<true>) {
	// get channel
	const salmonRunChannel = (await client.channels.fetch(getEnv("SALMON_RUN_CHANNEL_ID"))) as NewsChannel;

	// delete previous message
	await (await salmonRunChannel.messages.fetch({ limit: 1 })).first()?.delete();
	//const gear = await database.activeMonthlySalmonRunGear();

	// send message
	const message = await salmonRunChannel.send({
		...(await embeds(
			(b) =>
				rotations.salmonRun[0]?.embed(
					b.setAuthor({ name: "Data provided by splatoon3.ink", url: "https://splatoon3.ink/" }),
				),
			...rotations.salmonRun
				.slice(1, FUTURE_ROTATIONS_COUNT + 1)
				.map<OptionalEmbedFactory>(
					(v, i) => (b) =>
						b.setAuthor(i === 0 ? { name: "Future rotations" } : null).setDescription(v.short()),
				),
			(b) => rotations.eggstraWork[0]?.embed(b),
		)),
		files: (
			await parallel(rotations.salmonRun[0]?.images(), rotations.eggstraWork[0]?.images())
		).flatMap((x) => x ?? []),
	});

	// crosspost message
	await message.crosspost();
}

export async function sendRegularRotations(client: Client<true>) {
	// get channels
	const mapsChannel = (await client.channels.fetch(getEnv("MAPS_CHANNEL_ID"))) as NewsChannel;
	const generalChannel = (await client.channels.fetch(getEnv("GENERAL_CHANNEL_ID"))) as TextChannel;

	// delete previous message
	await (await mapsChannel.messages.fetch({ limit: 1 })).first()?.delete();
	await parallel(
		// set channel topic
		generalChannel.setTopic(generateChannelTopic()),

		async () => {
			// send message
			const message = await mapsChannel.send({
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
					(b) => rotations.splatfest[0]?.embed(b, rotations.splatfest.slice(1, FUTURE_ROTATIONS_COUNT + 1)),
					(b) => rotations.currentFest?.state === "SECOND_HALF" && rotations.currentFest.embed(b, []),
					(b) => rotations.turfWar[0]?.embed(b, rotations.turfWar.slice(1, FUTURE_ROTATIONS_COUNT + 1)),
					(b) =>
						rotations.rankedSeries[0]?.embed(
							b,
							rotations.rankedSeries.slice(1, FUTURE_ROTATIONS_COUNT + 1),
						),
					(b) => rotations.rankedOpen[0]?.embed(b, rotations.rankedOpen.slice(1, FUTURE_ROTATIONS_COUNT + 1)),
					(b) => rotations.xBattle[0]?.embed(b, rotations.xBattle.slice(1, FUTURE_ROTATIONS_COUNT + 1)),
				)),
				files: (
					await parallel(
						rotations.splatfest[0]?.images(),
						rotations.currentFest?.images(),
						rotations.turfWar[0]?.images(),
						rotations.rankedOpen[0]?.images(),
						rotations.rankedSeries[0]?.images(),
						rotations.xBattle[0]?.images(),
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
