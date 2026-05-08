import { bot } from "../bot";

export function sendAlert(chatId: number, message: string) {
  bot
    .sendMessage(chatId, message, { disable_web_page_preview: true })
    .then(() => console.log(`Alert sent to ${chatId}`))
    .catch((err) => console.error(`Failed to send alert to ${chatId}:`, err));
}
