import { ethers } from "ethers";
import { isTracked, getChatIdsForWallet } from "./walletService";
import { sendAlert } from "./alertService";

const EXPLORER_BASE =
  process.env.EXPLORER_BASE || "https://sepolia.etherscan.io/tx/";

function shortAddress(addr: string) {
  if (!addr) return "";
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-5)}`;
}

function formatEth(value?: ethers.BigNumberish) {
  try {
    const s = ethers.formatEther(value || 0);
    // trim to max 6 decimal places and remove trailing zeros
    const n = parseFloat(s);
    if (n === 0) return "0";
    return Number(n.toFixed(6)).toString();
  } catch (e) {
    return "0";
  }
}

export function startListener() {
  const wsUrl = process.env.ALCHEMY_WS;

  const provider = wsUrl ? new ethers.WebSocketProvider(wsUrl) : null;

  if (!provider) {
    console.error("ALCHEMY_WS not set");
    return;
  }

  console.log("Blockchain listener running...");

  provider.on("error", (err) => {
    console.error("WebSocket error:", err);
  });

  provider.on("close", () => {
    console.error("WebSocket closed.");
  });

  provider.on("block", async (blockNumber) => {
    console.log("New block:", blockNumber);

    try {
      const block = await provider.getBlock(blockNumber, true);

      if (!block || !block.transactions) return;

      for (const txOrHash of block.transactions) {
        let tx = txOrHash as any;

        if (typeof txOrHash === "string") {
          tx = await provider.getTransaction(txOrHash);
        }

        if (!tx) continue;

        await handleTx(tx);
      }
    } catch (err) {
      console.error("Block processing error:", err);
    }
  });
}

async function handleTx(tx: any) {
  const from = tx.from || "";
  const to = tx.to || "";

  console.log("TX:", tx.hash);

  if (from && isTracked(from)) {
    console.log("MATCH FROM:", from);

    const chatIds = getChatIdsForWallet(from);

    const amount = formatEth(tx.value);
    const direction = "🟢 OUTGOING TRANSACTION";
    const trackedWallet = from;

    const toDisplay = to || "(contract)";

    const message = `${direction}\n\nWallet:\n${shortAddress(trackedWallet)}\n\nAmount:\n${amount} ETH\n\nTo:\n${shortAddress(toDisplay)}\n\nTx:\n${EXPLORER_BASE}${tx.hash}`;

    chatIds.forEach((chatId) => sendAlert(chatId, message));
  }

  if (to && isTracked(to)) {
    console.log("MATCH TO:", to);

    const chatIds = getChatIdsForWallet(to);

    const amount = formatEth(tx.value);
    const direction = "🔴 INCOMING TRANSACTION";
    const trackedWallet = to;

    const fromDisplay = from || "(contract)";

    const message = `${direction}\n\nWallet:\n${shortAddress(trackedWallet)}\n\nAmount:\n${amount} ETH\n\nFrom:\n${shortAddress(fromDisplay)}\n\nTx:\n${EXPLORER_BASE}${tx.hash}`;

    chatIds.forEach((chatId) => sendAlert(chatId, message));
  }
}

export async function processTransaction(txHash: string) {
  const wsUrl = process.env.ALCHEMY_WS;
  if (!wsUrl) {
    throw new Error("ALCHEMY_WS not set");
  }
  const provider = new ethers.WebSocketProvider(wsUrl);
  const tx = await provider.getTransaction(txHash);
  if (!tx) throw new Error("Transaction not found: " + txHash);
  await handleTx(tx);
}
