import dotenv from "dotenv";
dotenv.config();

import { registerCommands } from "./bot/commands";
registerCommands();

console.log("Bot running...");