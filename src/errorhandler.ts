import type { RepliableInteraction, User } from "discord.js";
import { GuildMember, codeBlock, inlineCode } from "discord.js";
import { inspect } from "node:util";
import type { ZodIssue } from "zod";
import { ZodError } from "zod";
import Client from "./client.js";
import logger from "./utils/Logger.js";
import { embeds } from "./utils/discord/embeds.js";
import { parallel } from "./utils/promise.js";
import { pawait } from "./utils/result.js";
import { dedent, truncate } from "./utils/string.js";

/**
 * Custom type guard for checking if a value is an error.
 * @param e the thing to test
 * @returns e is Error
 */
export function isError(e: unknown): e is Error {
	return e instanceof Error;
}

export type ErrorData = {
	title: string;
	affectedUser?: GuildMember | User | undefined;
	interaction?: RepliableInteraction | undefined;
	description?: string | undefined;
	error?: Error | undefined;
};

function formatIssues(issues: ZodIssue[], indentLevel = 0): string[] {
	return issues
		.map((v) => [
			`${"\u00A0".repeat(indentLevel * 4)}${v.path.join(".")}: ${v.code}, ${v.message}`,
			v.code === "invalid_union"
				? v.unionErrors.map((v, i) => [i === 0 ? [] : "----", formatIssues(v.errors, indentLevel + 1)])
				: [],
		])
		.flat(4);
}

async function reportErrorInner(
	client: Client<true>,
	{ title, description, error, affectedUser, interaction }: ErrorData,
) {
	affectedUser ??= interaction?.member instanceof GuildMember ? interaction.member : interaction?.user;
	const parts = ["Error reported:", title];
	if (description) parts.push(description);
	if (error) parts.push(inspect(error, { depth: 1 }));
	logger.error(parts.join("\n"));
	const embed = await embeds((b) => {
		if (affectedUser) {
			const url = affectedUser.displayAvatarURL();
			b.setAuthor({
				...(url ? { iconURL: url } : {}),
				name: `@${affectedUser instanceof GuildMember ? affectedUser.user.username : affectedUser.username}`,
			});
		}
		return b
			.setColor("#ff0000")
			.setTitle(title)
			.setDescription(
				truncate(
					dedent`${description}
				${
					error
						? codeBlock(
								"ts",
								error instanceof ZodError
									? formatIssues(error.issues).join("\n")
									: error.stack?.replace(/(?<=\().*(?=josh)/gm, "") ??
											`${error.name}(${error.message})`,
							)
						: ""
				}`.trim(),
					4096,
				),
			)
			.setFooter({ text: "An error occurred 😭" })
			.setTimestamp(new Date());
	});
	// send error to owner,
	// reply or edit, and if it doesn't work: send to user in dms
	const result = await pawait(
		parallel((affectedUser?.id ?? "") !== client.owner.id && client.owner.send(embed), async () => {
			if (
				interaction &&
				(
					await pawait(
						interaction.replied
							? interaction.editReply({ ...embed, content: "", components: [], files: [] })
							: interaction.reply({ ...embed, components: [], files: [], ephemeral: true }),
					)
				).isOk()
			)
				return;
			await affectedUser?.send(embed);
		}),
	);
	if (result.isErr())
		logger.error(
			`Failed to send error report: ${title}\n${embed.embeds[0]?.data?.description}\n<@${affectedUser?.id}>`,
		);
}

export function reportError(data: ErrorData) {
	// wait for client to be ready
	void (async () => {
		await Client.loadedOnceSignal;
		await reportErrorInner(Client.instance!, data);
	})();
}

export function reportSchemaFail(name: string, code: string, error: ZodError) {
	reportError({
		title: `${name} API response failed schema validation`,
		error,
		description: dedent`${inlineCode(code)} failed, this may be caused by:
				- Incorrect schema design
				- The API changing
				The invalid data will still be used, this is just a forewarning.`,
	});
}
