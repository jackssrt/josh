import type { ButtonInteraction, ChatInputCommandInteraction, GuildMember } from "discord.js";
import { userMention } from "discord.js";
import { SQUID_SHUFFLE_EMOJI } from "../../emojis.js";
import { embeds } from "../../utils.js";
import { HIDER_EXPLANATION, PlayerRole, ROLE_ICON_MAP, SEEKER_EXPLANATION } from "./consts.js";

export default class Player<Host extends boolean = boolean> {
	public member: GuildMember;
	private readonly gameHost: Player<true>;
	constructor(
		public interaction: Host extends true ? ChatInputCommandInteraction<"cached"> : ButtonInteraction<"cached">,
		public host: Host,
		public role: PlayerRole | undefined,
		gameHost: Host extends true ? undefined : Player<true>,
		private readonly gameCode: string,
	) {
		this.gameHost = gameHost ?? (this as Player<true>);
		this.member = interaction.member;
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
		return `${this.role !== undefined ? ROLE_ICON_MAP[this.role] : this.host ? "👑" : "👤"} - ${userMention(
			this.member.id,
		)}`;
	}
	public async roleEmbed() {
		const hostIcon = this.gameHost.member.avatarURL();
		return await embeds((b) =>
			b
				.setAuthor(
					!this.host
						? {
								name: `Host: ${this.gameHost.member.displayName}・Room code: ${this.gameCode}`,
								...(hostIcon ? { iconURL: hostIcon } : {}),
						  }
						: null,
				)
				.setTitle(
					this.role === undefined
						? `Waiting for role... ${SQUID_SHUFFLE_EMOJI}`
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
