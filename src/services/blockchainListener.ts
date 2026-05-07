import { ethers } from "ethers";
import { isTracked } from "./walletService";
import { sendAlert } from "./alertService";

export function startListener() {
  const provider = new ethers.WebSocketProvider(
    process.env.ALCHEMY_WS!
  );

  provider.on("pending", async (txHash) => {
    try {
      const tx = await provider.getTransaction(txHash);

      if (!tx) return;

      if (isTracked(tx.from)) {
        console.log("Tracked wallet activity");

        sendAlert(
          6170099446,
          `Wallet activity detected:\n${tx.hash}`
        );
      }
    } catch (err) {
      console.error(err);
    }
  });
}