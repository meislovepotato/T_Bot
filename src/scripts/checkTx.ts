import { processTransaction } from "../services/blockchainListener";

async function main() {
  const tx = process.argv[2];
  if (!tx) {
    console.error("Usage: npx ts-node src/scripts/checkTx.ts <txHash>");
    process.exit(1);
  }

  try {
    await processTransaction(tx);
    console.log("processTransaction completed");
  } catch (err) {
    console.error("Error processing transaction:", err);
    process.exit(1);
  }
}

main();
