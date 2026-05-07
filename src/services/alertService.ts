import { bot } from "../bot";

export function sendAlert(chatId: number, message: string) {
  bot.sendMessage(chatId, message);
}