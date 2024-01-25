import { randomUUID } from "crypto";
import type { SlashCommandStringOption } from "discord.js";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonInteraction,
	ButtonStyle,
	Collection,
	ComponentType,
	Message,
	inlineCode,
} from "discord.js";
import { match } from "ts-pattern";
import type { Except } from "type-fest";
import type { AnnouncementData } from "../announcements.js";
import {
	createUserAnnouncement,
	deleteAnnouncement,
	generatePreviewAnnouncementContent,
	updatePublishedAnnouncement,
} from "../announcements.js";
import type Client from "../client.js";
import type { GuildOnlyChatCommandInteraction } from "../command.js";
import createCommand from "../command.js";
import database from "../database.js";
import { search } from "../utils/array.js";
import { parallel, parallelRace } from "../utils/promise.js";

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

type Subcommand = "create" | "delete" | "publish";

const addIdOption = (b: SlashCommandStringOption) =>
	b.setName("id").setDescription("Announcement id").setAutocomplete(true).setRequired(true);

export default createCommand({
	data: (b) =>
		b
			.setDescription("Manage announcements")
			.addSubcommand((b) => b.setName("create").setDescription("Creates a user announcement."))
			.addSubcommand((b) =>
				b.setName("delete").setDescription("Deletes an announcement.").addStringOption(addIdOption),
			)
			.addSubcommand((b) =>
				b.setName("publish").setDescription("Publishes an announcement.").addStringOption(addIdOption),
			)
			.setDMPermission(false),
	guildOnly: true,
	ownerOnly: true,
	async autocomplete({ interaction }) {
		const focused = interaction.options.getFocused(true);
		if (focused.name !== "id") return;
		const announcementIds = await database.getAllAnnouncementIds();
		const results = search(announcementIds, focused.value);
		await interaction.respond(results.slice(0, 25).map((v) => ({ name: v, value: v })));
	},
	async execute({ client, interaction }) {
		await match(interaction.options.getSubcommand() as Subcommand)
			.with("create", async () => {
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
			})
			.with("delete", async () => {
				const id = interaction.options.getString("id", true);
				if (await deleteAnnouncement(client, id))
					await interaction.reply(`successfully deleted announcement with id ${inlineCode(id)}`);
				else await interaction.reply(`there is no announcement with id ${inlineCode(id)}`);
			})
			.with("publish", async () => {
				const id = interaction.options.getString("id", true);
				if (await updatePublishedAnnouncement(client, id))
					await interaction.reply(`successfully published announcement with id ${inlineCode(id)}`);
				else await interaction.reply(`there is no announcement with id ${inlineCode(id)}`);
			})
			.exhaustive();
	},
});
