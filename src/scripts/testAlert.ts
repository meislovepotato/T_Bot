import { sendAlert } from "../services/alertService";

async function main() {
  const chat = process.argv[2];
  const msg = process.argv[3] || "Test alert from wallet-alert-bot";

  if (!chat) {
    console.error("Usage: npx ts-node -r dotenv/config src/scripts/testAlert.ts <chatId> [message]");
    process.exit(1);
  }

  const chatId = Number(chat);

  sendAlert(chatId, msg);
}

main();
