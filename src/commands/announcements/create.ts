import { createUserAnnouncement, generatePreviewAnnouncementContent, type AnnouncementData } from "@/announcements.js";
import type Client from "@/client.js";
import type { GuildOnlyChatCommandInteraction } from "@/commandHandler/command.js";
import createSubcommand from "@/commandHandler/subcommand.js";
import { parallel, parallelRace } from "@/utils/promise.js";
import { randomUUID } from "crypto";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonInteraction,
	ButtonStyle,
	Collection,
	ComponentType,
	Message,
} from "discord.js";
import type { Except } from "type-fest";

type CollectMessageParams<Skip extends boolean> = {
	client: Client<true>;
	interaction: GuildOnlyChatCommandInteraction;
	progressMessage: Message;
	id: string;
	data: Partial<AnnouncementData<true>>;
	index: number;
	allowSkip: Skip;
	carry?: Message | ButtonInteraction | undefined;
};

async function updateMessage<Skip extends boolean>({
	client,
	interaction,
	id,
	data,
	index,
	allowSkip,
	carry,
}: Except<CollectMessageParams<Skip>, "progressMessage">) {
	const msgContent = {
		...(await generatePreviewAnnouncementContent(client, id, data, index)),
		components: allowSkip
			? [
					new ActionRowBuilder<ButtonBuilder>().addComponents(
						new ButtonBuilder().setLabel("Skip").setStyle(ButtonStyle.Danger).setCustomId("skip"),
					),
				]
			: [],
	};
	const carryInteraction = carry instanceof ButtonInteraction ? carry : undefined;

	await (carryInteraction?.update(msgContent) ?? interaction.editReply(msgContent));
}

export async function collectMessage<Skip extends boolean>(params: CollectMessageParams<Skip>) {
	const { interaction, progressMessage, allowSkip, index } = params;
	const filter = (v: Message | ButtonInteraction) => v.member === interaction.member;
	const [carryResult] = await parallel(
		parallelRace(
			// already checked before
			interaction.channel!.awaitMessages({ max: 1, filter }),
			allowSkip && progressMessage.awaitMessageComponent({ componentType: ComponentType.Button, filter }),
		),
		index !== 0 && updateMessage(params),
	);
	return (carryResult instanceof Collection ? carryResult.first() : carryResult) as Skip extends true
		? Message | ButtonInteraction
		: Message;
}

export default createSubcommand({
	data: (b) => b.setDescription("Creates a user announcement."),
	guildOnly: true,
	async execute({ client, interaction }) {
		if (!interaction.channel) return;
		const id = `user-${randomUUID() as string}` as const;
		const data: Partial<AnnouncementData<true>> = {
			authorId: interaction.user.id,
			previewChannelId: interaction.channelId,
		};
		const progressMessage = await interaction.reply({
			...(await generatePreviewAnnouncementContent(client, id, data, 0)),
			fetchReply: true,
		});
		data.previewMessageId = progressMessage.id;

		// set title
		const title = await collectMessage({
			client,
			interaction,
			progressMessage,
			id,
			data,
			index: 0,
			allowSkip: false,
		});
		data.title = title.content;
		data.titleMessageId = title.id;

		// set description
		const description = await collectMessage({
			client,
			interaction,
			progressMessage,
			id,
			data,
			index: 1,
			allowSkip: false,
		});
		data.description = description.content;
		data.descriptionMessageId = description.id;

		// set hiddenText
		const hiddenText = await collectMessage({
			client,
			interaction,
			progressMessage,
			id,
			data,
			index: 2,
			allowSkip: true,
		});
		if (hiddenText instanceof Message) {
			data.hiddenText = hiddenText.content;
			data.hiddenTextMessageId = hiddenText.id;
		}

		// set mentioned
		const mentioned = await collectMessage({
			client,
			interaction,
			progressMessage,
			id,
			data,
			index: 3,
			carry: hiddenText,
			allowSkip: true,
		});
		if (mentioned instanceof Message) {
			data.mentioned = {
				users: mentioned.mentions.users.map((v) => v.id),
				roles: mentioned.mentions.roles.map((v) => v.id),
				everyone: mentioned.mentions.everyone,
			};
			data.mentionedMessageId = mentioned.id;
		}

		await createUserAnnouncement(id, data as AnnouncementData<true>);
		await updateMessage({ client, interaction, id, data, allowSkip: false, index: 4, carry: mentioned });
	},
});
