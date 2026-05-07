import dotenv from "dotenv";
dotenv.config();

import { registerCommands } from "./bot/commands";
registerCommands();

import { startListener } from "./services/blockchainListener";
startListener();

console.log("Bot running...");