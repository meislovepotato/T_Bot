import { ethers } from "ethers";
import { isTracked, getChatIdsForWallet } from "./walletService";
import { sendAlert } from "./alertService";

function shortAddress(addr: string) {
  if (!addr) return "";
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-5)}`;
}

function formatEth(value?: ethers.BigNumberish) {
  try {
    const v = ethers.BigNumber.isBigNumber(value) ? value : ethers.BigNumber.from(value || 0);
    const s = ethers.utils.formatEther(v);
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
  if (!wsUrl) {
    console.error("ALCHEMY_WS not set");
    return;
  }

  const explorerBase = process.env.EXPLORER_BASE || "https://sepolia.etherscan.io/tx/";

  const provider = new ethers.WebSocketProvider(wsUrl);

  console.log("Blockchain listener running...");

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

        const from = tx.from || "";
        const to = tx.to || "";

        console.log("TX:", tx.hash);

        // if tracked as sender -> outgoing
        if (from && isTracked(from)) {
          console.log("MATCH FROM:", from);

          const chatIds = getChatIdsForWallet(from);

          const amount = formatEth(tx.value);
          const direction = "🟢 OUTGOING TRANSACTION";
          const trackedWallet = from;

          const toDisplay = to || "(contract)";

          const message = `${direction}\n\nWallet:\n${shortAddress(trackedWallet)}\n\nAmount:\n${amount} ETH\n\nTo:\n${shortAddress(toDisplay)}\n\nTx:\n${explorerBase}${tx.hash}`;

          chatIds.forEach((chatId) => {
            sendAlert(chatId, message);
          });
        }

        // if tracked as receiver -> incoming
        if (to && isTracked(to)) {
          console.log("MATCH TO:", to);

          const chatIds = getChatIdsForWallet(to);

          const amount = formatEth(tx.value);
          const direction = "🔴 INCOMING TRANSACTION";
          const trackedWallet = to;

          const fromDisplay = from || "(contract)";

          const message = `${direction}\n\nWallet:\n${shortAddress(trackedWallet)}\n\nAmount:\n${amount} ETH\n\nFrom:\n${shortAddress(fromDisplay)}\n\nTx:\n${explorerBase}${tx.hash}`;

          chatIds.forEach((chatId) => {
            sendAlert(chatId, message);
          });
        }
      }
    } catch (err) {
      console.error("Block processing error:", err);
    }
  });
}
