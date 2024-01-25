import type { TextBasedChannel } from "discord.js";
import type { defined } from "../types.js";

export type WebhookableChannel = Extract<TextBasedChannel, { fetchWebhooks: defined }>;
