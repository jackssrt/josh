import type { Awaitable, InteractionReplyOptions } from "discord.js";
import { EmbedBuilder } from "discord.js";
import { parallel } from "../promise.js";
import type { Maybe } from "../types.js";

export type EmbedFactory = (b: EmbedBuilder) => Awaitable<EmbedBuilder>;
export type OptionalEmbedFactory = (b: EmbedBuilder) => Awaitable<Maybe<EmbedBuilder>>;

/**
 * Provides EmbedBuilders with defaults set.
 * @example await interaction.reply(await embeds((b) => b.setTitle("Hello!")))
 * @param funcs Rest or array of functions that accept an embed builder and possibly return it
 * @returns Ready to send `InteractionReplyOptions`, access `.embeds` to get the resulting embeds
 */
export async function embeds(...funcs: OptionalEmbedFactory[]) {
	return {
		embeds: (
			await parallel(funcs.map(async (func) => (await func(new EmbedBuilder().setColor("#2b2d31"))) || []))
		).flat(),
	} satisfies InteractionReplyOptions;
}

/**
 * Constructs a wrapper around embeds, allowing custom default embed options.\
 * This is a curried function.
 * @param baseFactory The factory that takes in the original EmbedBuilder from {@link embeds}
 * @returns The wrapped version of {@link embeds}
 */
export function constructEmbedsWrapper(baseFactory: EmbedFactory): typeof embeds {
	return async (...funcs) =>
		await embeds(...funcs.map<OptionalEmbedFactory>((v) => async (b) => v(await baseFactory(b))));
}
