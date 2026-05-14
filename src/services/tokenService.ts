import { ethers } from "ethers";

const ERC20_TRANSFER_TOPIC = ethers.id("Transfer(address,address,uint256)");

export function parseERC20Transfers(receipt: any) {
  const transfers: any[] = [];

  if (!receipt?.logs) {
    return transfers;
  }

  for (const log of receipt.logs) {
    try {
      if (!log.topics || log.topics.length < 3) {
        continue;
      }

      // ERC20 Transfer event
      if (log.topics[0] !== ERC20_TRANSFER_TOPIC) {
        continue;
      }

      const from = ethers.getAddress(`0x${log.topics[1].slice(26)}`);

      const to = ethers.getAddress(`0x${log.topics[2].slice(26)}`);

      // skip malformed logs
      if (!log.data || log.data === "0x") {
        continue;
      }

      const amount = ethers.getBigInt(log.data);

      transfers.push({
        token: log.address,
        from,
        to,
        amount,
      });
    } catch (err) {
      console.error("ERC20 parse error:", err);
    }
  }

  return transfers;
}
