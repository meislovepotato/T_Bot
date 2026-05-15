process.on("unhandledRejection", (reason) => {
  console.error("🔥 Unhandled Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("💥 Uncaught Exception:", error);
});

import dotenv from "dotenv";
dotenv.config();

import { registerCommands } from "./bot/commands";
registerCommands();

import { startListener } from "./services/blockchainListener";
startListener();

console.log("Bot running...");