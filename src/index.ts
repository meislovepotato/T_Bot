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

import express from "express";

const app = express();

app.get("/health", (_, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`Health server listening on ${PORT}`);
});

console.log("Bot running...");