import type { ButtonInteraction, ChatInputCommandInteraction, User } from "discord.js";
import { SQUIDSHUFFLE_EMOJI } from "../../emojis.js";
import { embeds } from "../../utils.js";
import { HIDER_EXPLANATION, ROLE_ICON_MAP, SEEKER_EXPLANATION } from "./consts.js";
import type Game from "./Game.js";
import type { GameState } from "./Game.js";

export const enum PlayerRole {
	Seeker,
	Hider,
}
export default class Player<Host extends boolean = boolean> {
	public user: User;
	constructor(
		public interaction: Host extends true ? ChatInputCommandInteraction : ButtonInteraction,
		public host: Host,
		public role: PlayerRole | undefined,
		private game: Game<GameState>,
	) {
		this.user = interaction.user;
	}
	/**
	 * This method should only be used as a typeguard,
	 * if you don't need to check the type you should instead use the property {@link host} directly
	 * @returns this is host player
	 */
	public isHost(): this is Player<true> {
		return this.host;
	}
	/**
	 * This method should only be used as a typeguard,
	 * if you don't need to check the type you should instead use the property {@link host} directly.
	 * This function only exists cause typescript doesn't narrow `Player<boolean>` down to `Player<false>`
	 * if you check with `if (!player.isHost())`
	 * @returns this is NOT host player
	 */
	public isNotHost(): this is Player<false> {
		return !this.host;
	}

	public playerListItem() {
		return `${this.role !== undefined ? ROLE_ICON_MAP[this.role] : this.host ? "👑" : "👤"} - <@${this.user.id}>`;
	}
	public async roleEmbed() {
		return await embeds((b) => {
			b.setAuthor(
				!this.host
					? {
							name: `Host: ${this.game.host.user.username}・Room code: ${this.game.code}`,
							iconURL: this.game.host.user.avatarURL() || "",
					  }
					: null,
			)
				.setTitle(
					this.role === undefined
						? `Waiting for role... ${SQUIDSHUFFLE_EMOJI}`
						: `Your role: ${this.role === PlayerRole.Seeker ? "Seeker" : "Hider"} ${
								ROLE_ICON_MAP[this.role]
						  }`,
				)
				.setDescription(
					this.role !== undefined
						? this.role === PlayerRole.Seeker
							? SEEKER_EXPLANATION
							: HIDER_EXPLANATION
						: null,
				);

			if (this.role !== undefined)
				b.setColor(
					this.role === PlayerRole.Seeker ? "#55acee" : this.role === PlayerRole.Hider ? "#fdcb58" : null,
				);
			return b;
		});
	}
}
