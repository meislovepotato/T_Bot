import { bot } from "./index";
import { addWallet } from "../services/walletService";

const users = new Map<number, any>(); // temporary memory (DB later)

export function registerCommands() {
  // /start
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;

    users.set(chatId, {
      chatId,
      wallets: [],
    });

    bot.sendMessage(chatId, "Wallet Alert Bot is active.\nUse /track <wallet>");
  });

  // /track wallet
  bot.onText(/\/track (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const wallet = match?.[1];

    if (!wallet) {
      return bot.sendMessage(chatId, "Invalid wallet address");
    }

    const user = users.get(chatId) || { chatId, wallets: [] };
    user.wallets.push(wallet);

    users.set(chatId, user);

    // add to global tracking registry
    addWallet(wallet);

    bot.sendMessage(chatId, `Tracking wallet:\n${wallet}`);
  });

  console.log("Commands registered");
}
