import { bot } from "./index";
import { addWallet, getWalletsForChat } from "../services/walletService";

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
    let wallet = match?.[1];

    if (!wallet) {
      return bot.sendMessage(chatId, "Invalid wallet address");
    }

    wallet = wallet.trim();
    // normalize simple input
    if (!wallet.startsWith("0x")) wallet = `0x${wallet}`;

    const user = users.get(chatId) || { chatId, wallets: [] };
    user.wallets.push(wallet);

    users.set(chatId, user);

    // add to global tracking registry for this chat
    addWallet(chatId, wallet);

    const tracked = getWalletsForChat(chatId);

    bot.sendMessage(
      chatId,
      `Tracking wallet:\n${wallet}\n\nYour tracked wallets:\n${tracked.join("\n")}`,
    );
  });

  // /list - show wallets this chat is tracking
  bot.onText(/\/list/, (msg) => {
    const chatId = msg.chat.id;
    const tracked = getWalletsForChat(chatId);
    bot.sendMessage(
      chatId,
      `Your tracked wallets:\n${tracked.join("\n") || "(none)"}`,
    );
  });

  console.log("Commands registered");
}
