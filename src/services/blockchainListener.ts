import { ethers } from "ethers";
import { isTracked } from "./walletService";

export function startListener() {
  const provider = new ethers.WebSocketProvider(process.env.ALCHEMY_WS!);

  provider.on("pending", async (txHash) => {
    try {
      const tx = await provider.getTransaction(txHash);
      if (!tx) return;

      if (isTracked(tx.from)) {
        console.log("Tracked wallet activity:", tx);
      }
    } catch (err) {}
  });

  console.log("Blockchain listener running...");
}