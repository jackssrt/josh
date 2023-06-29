import { BULLET_EMOJI, EMPTY_EMOJI, SEEKER_EMOJI, SUB_EMOJI, VEEMO_PEEK_EMOJI } from "../../emojis.js";

export const SECONDS_TO_JOIN = 60 * 10;
export const SECONDS_TO_PICK_TEAMS = 60 * 10;
export const SECONDS_TO_PLAY_AGAIN = 60 * 1;
export const SECONDS_TO_CONFIRM_LEAVE = 30;
export const enum PlayerRole {
	Seeker,
	Hider,
}

export const ROLE_ICON_MAP = {
	[PlayerRole.Seeker]: SEEKER_EMOJI,
	[PlayerRole.Hider]: VEEMO_PEEK_EMOJI,
} as const;

export const RULES = `${BULLET_EMOJI}Banned specials:
${EMPTY_EMOJI}${SUB_EMOJI}${BULLET_EMOJI}Tenta missiles
${EMPTY_EMOJI}${EMPTY_EMOJI}${BULLET_EMOJI}Killer wail 5.1
${EMPTY_EMOJI}${EMPTY_EMOJI}${BULLET_EMOJI}Wave breaker
${EMPTY_EMOJI}${EMPTY_EMOJI}${BULLET_EMOJI}Kraken
${BULLET_EMOJI}No ninja squid.
${BULLET_EMOJI}No hiding where the seekers can't reach you.

${BULLET_EMOJI}First the hiders will pick their hiding spots
${BULLET_EMOJI}After 1 minute in turf war or 2 minutes in ranked,
${EMPTY_EMOJI}the seekers will go look for the hiders.

${BULLET_EMOJI}**Seekers ${ROLE_ICON_MAP[PlayerRole.Seeker]}**
${EMPTY_EMOJI}${SUB_EMOJI}${BULLET_EMOJI}aren't allowed to use the map during hiding time
${EMPTY_EMOJI}${EMPTY_EMOJI}${BULLET_EMOJI}aren't allowed to use sub weapons while seeking for hiders
${EMPTY_EMOJI}${EMPTY_EMOJI}${BULLET_EMOJI}are only allowed to super jump to squid beacons or big bubblers
${EMPTY_EMOJI}${EMPTY_EMOJI}${BULLET_EMOJI}win if they splat all hiders once

${BULLET_EMOJI}**Hiders ${ROLE_ICON_MAP[PlayerRole.Hider]}**
${EMPTY_EMOJI}${SUB_EMOJI}${BULLET_EMOJI}aren't allowed to use the map
${EMPTY_EMOJI}${EMPTY_EMOJI}${BULLET_EMOJI}are allowed to fight back with their main weapons, sub weapons and special weapons if they get found
${EMPTY_EMOJI}${EMPTY_EMOJI}${BULLET_EMOJI}win if they survive until the match ends
${EMPTY_EMOJI}${EMPTY_EMOJI}${BULLET_EMOJI}aren't allowed to distract the seekers after they get splatted`;
export const SEEKER_EXPLANATION = `${BULLET_EMOJI}As a seeker you're first going to back up and face away from the map.
${BULLET_EMOJI}Meanwhile the hiders are going to be painting the map and picking their hiding spots...
${BULLET_EMOJI}Only after hiding time is up can you start seeking!
${BULLET_EMOJI}Remember that the hiders can fight back!`;
export const HIDER_EXPLANATION = `${BULLET_EMOJI}As a hider you're going to head straight to the other teams base or mid,
${EMPTY_EMOJI}paint it and find a good hiding spot.
${BULLET_EMOJI}The seekers will start seeking after I send a message saying that hiding time is up.
${BULLET_EMOJI}If you survive until the match ends you've won!`;
