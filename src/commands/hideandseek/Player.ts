import type { ButtonInteraction, ChatInputCommandInteraction, User } from "discord.js";
import { SQUIDSHUFFLE_EMOJI } from "../../emojis.js";
import { embeds } from "../../utils.js";
import { HIDER_EXPLANATION, ROLE_ICON_MAP, SEEKER_EXPLANATION } from "./consts.js";

export const enum PlayerRole {
	Seeker,
	Hider,
}
export default class Player<Host extends boolean = boolean> {
	public user: User;
	private gameHost: Player<true>;
	constructor(
		public interaction: Host extends true ? ChatInputCommandInteraction : ButtonInteraction,
		public host: Host,
		public role: PlayerRole | undefined,
		gameHost: Host extends true ? undefined : Player<true>,
		private gameCode: string,
	) {
		this.gameHost = gameHost ?? (this as Player<true>);
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
		return await embeds((b) =>
			b
				.setAuthor(
					!this.host
						? {
								name: `Host: ${this.gameHost.user.username}・Room code: ${this.gameCode}`,
								iconURL: this.gameHost.user.avatarURL() ?? "",
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
				)
				.setFooter(
					this.role === undefined && !this.host
						? { text: `You can leave this game by pressing on the "I'm in!" button again` }
						: null,
				)
				.setColor(
					this.role === PlayerRole.Seeker
						? "#55acee"
						: this.role === PlayerRole.Hider
						? "#fdcb58"
						: "#2b2d31",
				),
		);
	}
}
