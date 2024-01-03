import type { Awaitable, InteractionReplyOptions } from "discord.js";
import { EmbedBuilder } from "discord.js";
import { parallel } from "../promise";
import type { Maybe } from "../types.js";

export type EmbedFactory = (b: EmbedBuilder) => Awaitable<EmbedBuilder>;
export type OptionalEmbedFactory = (b: EmbedBuilder) => Awaitable<Maybe<EmbedBuilder>>;

export async function embeds(...funcs: OptionalEmbedFactory[]) {
	return {
		embeds: (
			await parallel(funcs.map(async (func) => (await func(new EmbedBuilder().setColor("#2b2d31"))) || []))
		).flat(),
	} satisfies InteractionReplyOptions;
}

export function constructEmbedsWrapper(baseFactory: EmbedFactory): typeof embeds {
	return async (...funcs) =>
		await embeds(...funcs.map<OptionalEmbedFactory>((v) => async (b) => v(await baseFactory(b))));
}
