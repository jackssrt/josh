import type { MessageCreateOptions, MessageEditOptions, NewsChannel } from "discord.js";
import { TimestampStyles, time } from "discord.js";
import rotations from "../rotations/index.js";
import type { GenericCoopNode, GenericMatchNode } from "../rotations/nodes.js";
import type { EmbedFactory } from "../utils/discord/embeds.js";
import { embeds } from "../utils/discord/embeds.js";
import { parallel } from "../utils/promise.js";
import type { Maybe } from "../utils/types.js";
import type Client from "./../client.js";
import createEvent from "./../commandHandler/event.js";

const FUTURE_ROTATIONS_COUNT = 3;

type NodePair<T> = readonly [T, readonly T[]];

type MatchNodePair<T extends GenericMatchNode = GenericMatchNode> = NodePair<T>;
type CoopNodePair<T extends GenericCoopNode = GenericCoopNode> = NodePair<T>;

function generateChannelTopic(nodes: readonly MatchNodePair[]): string {
	const parts = [
		`↻ ${time(rotations.endTime, TimestampStyles.RelativeTime)}`,
		...nodes.map(([active, future]) => active.channelTopic(future[0])),
	];
	return parts.join("\n・\n");
}

async function sendRotation(
	channel: NewsChannel,
	notificationText: MessageCreateOptions | string,
	mainMessageCreator: () => Promise<MessageEditOptions>,
) {
	// get message data
	// get previous message
	const [mainMessageData, oldMessage] = await parallel(mainMessageCreator, channel.messages.fetch({ limit: 1 }));
	// delete old message
	// send message
	// crosspost message
	await parallel(async () => {
		const message = await channel.send(notificationText);
		await parallel(message.crosspost(), message.edit({ content: "", ...mainMessageData }));
	}, oldMessage.first()?.delete());
}

export async function sendSalmonRunRotation(client: Client<true>) {
	const nodes = (
		[
			[rotations.eggstraWork.active, []],
			[rotations.bigRun.active, []],
			[rotations.salmonRun.active, rotations.salmonRun.future(FUTURE_ROTATIONS_COUNT)],
		] as const satisfies readonly (readonly [
			GenericCoopNode | undefined,
			readonly (GenericCoopNode | undefined)[],
		])[]
	).filter((v) => v[0]) as readonly CoopNodePair[];

	await sendRotation(
		client.salmonRunChannel,
		nodes.map(([active]) => active.notificationText()).join("\n"),
		async () => ({
			...(await embeds(
				...nodes.flatMap<EmbedFactory>(([active, future]) =>
					active.name === "Salmon Run"
						? [
								(b) =>
									active.embed(
										b.setAuthor({
											name: "Data provided by splatoon3.ink",
											url: "https://splatoon3.ink/",
										}),
									),
								...future.map<EmbedFactory>(
									(v, i) => (b) =>
										b.setAuthor(i === 0 ? { name: "Future rotations" } : null).setDescription(
											v
												.short()
												.map((v) => v.join(" "))
												.join("\n"),
										),
								),
							]
						: (b) => active.embed(b),
				),
			)),
			files: (await parallel(nodes.map(([active]) => active.attachments()))).flat(),
		}),
	);
}

export async function sendRegularRotations(client: Client<true>) {
	const nodes = (
		[
			[rotations.splatfestOpen.active, rotations.splatfestOpen.future(FUTURE_ROTATIONS_COUNT)] as const,
			[rotations.splatfestPro.active, rotations.splatfestPro.future(FUTURE_ROTATIONS_COUNT)] as const,
			[rotations.currentFest?.state === "SECOND_HALF" && rotations.currentFest, []] as const,
			[rotations.challenges.active, []] as const,
			[rotations.turfWar.active, rotations.turfWar.future(FUTURE_ROTATIONS_COUNT)] as const,
			[rotations.rankedSeries.active, rotations.rankedSeries.future(FUTURE_ROTATIONS_COUNT)] as const,
			[rotations.rankedOpen.active, rotations.rankedOpen.future(FUTURE_ROTATIONS_COUNT)] as const,
			[rotations.xBattle.active, rotations.xBattle.future(FUTURE_ROTATIONS_COUNT)] as const,
		] as const satisfies readonly (readonly [Maybe<GenericMatchNode>, readonly (GenericMatchNode | undefined)[]])[]
	).filter((v) => v[0]) as readonly MatchNodePair[];

	await parallel(
		// set channel topic
		async () => await client.generalChannel.setTopic(generateChannelTopic(nodes)),

		sendRotation(client.mapsChannel, nodes.map(([active]) => active.notificationText()).join("\n"), async () => ({
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
				...nodes.map<EmbedFactory>(
					([active, future]) =>
						(b) =>
							active.embed(b, future),
				),
			)),
			files: (await parallel(nodes.map(([active]) => active.attachments()))).flat(),
		})),
	);
}

export default createEvent({
	event: "ready",
	on({ client }) {
		rotations.hook(async () => await sendRegularRotations(client));
		rotations.hookSalmon(async () => await sendSalmonRunRotation(client));
	},
});
