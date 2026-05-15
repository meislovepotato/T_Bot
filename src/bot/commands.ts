import { bot } from "./index";
import {
  addWallet,
  getWalletsForChat,
  removeWallet,
} from "../services/walletService";
import { isAddress } from "ethers";

const users = new Map<number, any>(); // temporary memory (DB later)

// cooldown map
const cooldowns = new Map<number, number>();

const COOLDOWN_MS = 3000;

function isOnCooldown(chatId: number) {
  const last = cooldowns.get(chatId);

  if (!last) return false;

  return Date.now() - last < COOLDOWN_MS;
}

function updateCooldown(chatId: number) {
  cooldowns.set(chatId, Date.now());
}

export function registerCommands() {
  // /start
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;

    users.set(chatId, {
      chatId,
      wallets: [],
    });

    bot.sendMessage(
      chatId,
      "Wallet Alert Bot is active.\n\nCommands:\n/track <wallet>\n/untrack <wallet>\n/list",
    );
  });

  // /track wallet
  bot.onText(/\/track (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;

    if (isOnCooldown(chatId)) {
      return bot.sendMessage(
        chatId,
        "Please wait before sending another command.",
      );
    }

    updateCooldown(chatId);

    let wallet = match?.[1];

    if (!wallet) {
      return bot.sendMessage(chatId, "Invalid wallet address");
    }

    wallet = wallet.trim().toLowerCase();

    // normalize simple input
    if (!wallet.startsWith("0x")) {
      wallet = `0x${wallet}`;
    }

    // validate wallet
    if (!isAddress(wallet)) {
      return bot.sendMessage(chatId, "Invalid BaseMainnet wallet address.");
    }

    const result = await addWallet(chatId, wallet);

    if (!result.success) {
      return bot.sendMessage(chatId, result.message);
    }

    const tracked = await getWalletsForChat(chatId);

    bot.sendMessage(
      chatId,
      `Tracking wallet:\n${wallet}\n\nYour tracked wallets:\n${tracked.join("\n")}`,
    );
  });

  // /untrack wallet
  bot.onText(/\/untrack (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;

    let wallet = match?.[1];

    if (!wallet) {
      return bot.sendMessage(chatId, "Provide a wallet to untrack.");
    }

    wallet = wallet.trim().toLowerCase();

    if (!wallet.startsWith("0x")) {
      wallet = `0x${wallet}`;
    }

    const result = await removeWallet(chatId, wallet);

    if (!result.success) {
      return bot.sendMessage(chatId, result.message);
    }

    const tracked = await getWalletsForChat(chatId);

    bot.sendMessage(
      chatId,
      `🗑 Wallet removed:\n${wallet}\n\nTracked wallets:\n${tracked.join("\n") || "(none)"}`,
    );
  });

  // /list - show wallets this chat is tracking
  bot.onText(/\/list/, async (msg) => {
    const chatId = msg.chat.id;
    const tracked = await getWalletsForChat(chatId);
    bot.sendMessage(
      chatId,
      `Your tracked wallets:\n\n${tracked.join("\n") || "(none)"}`,
    );
  });

  console.log("Commands registered");
}
