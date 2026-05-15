import TelegramBot from "node-telegram-bot-api";
import { env } from "../config/env";

export const bot = new TelegramBot(env.BOT_TOKEN, {
  polling: true,
});