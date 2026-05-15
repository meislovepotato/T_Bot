import { ethers } from "ethers";
import { isTracked, getChatIdsForWallet } from "./walletService";
import { sendAlert } from "./alertService";
import { parseERC20Transfers } from "./tokenService";

const wsUrl = process.env.ALCHEMY_WS || "";

const provider = wsUrl ? new ethers.WebSocketProvider(wsUrl) : null;

const EXPLORER_BASE = process.env.EXPLORER_BASE || "https://basescan.org/tx/";

const KNOWN_SELECTORS: Record<string, string> = {
  "0xa9059cbb": "transfer",
  "0x23b872dd": "transferFrom",
  "0x095ea7b3": "approve",
  "0x38ed1739": "swapExactTokensForTokens",
  "0x7ff36ab5": "swapExactETHForTokens",
  "0x18cbafe5": "swapExactTokensForETH",
  "0x5ae401dc": "multicall",
};

const KNOWN_CONTRACTS: Record<string, string> = {
  "0x4200000000000000000000000000000000000015": "Base Bridge",
};

const TOKEN_CACHE = new Map<
  string,
  {
    symbol: string;
    decimals: number;
  }
>();

function classifyAction(action: string) {
  const lower = action.toLowerCase();
  if (lower.includes("swap")) return "🟣 SWAP";
  if (lower.includes("approve")) return "🟡 APPROVAL";
  if (lower.includes("transfer") || lower.includes("transferfrom"))
    return "🟢 TRANSFER";
  if (lower.includes("mint")) return "🟠 MINT";
  if (lower.includes("bridge") || lower.includes("deposit")) return "🟤 BRIDGE";
  if (lower.includes("game")) return "🎮 GAME INTERACTION";
  if (lower.includes("transfer")) {
    return "🟢 TRANSFER";
  }
  return "🔵 CONTRACT INTERACTION";
}

function resolveName(address: string) {
  if (!address) return "(contract)";
  const n = KNOWN_CONTRACTS[address.toLowerCase()];
  return n || shortAddress(address);
}

function humanizeAction(action: string) {
  const name = String((action || "").split("(")[0]);
  const map: Record<string, string> = {
    approve: "Approved token spending",
    swappexactethfortokens: "Bought tokens",
    swappexacttokensforeth: "Sold tokens",
    swappexacttokensfortokens: "Swapped tokens",
    mint: "Minted token/NFT",
    deposit: "Bridge deposit",
    withdraw: "Withdrawal",
    multicall: "Batched contract calls",
    setrootforgame: "Updated game state",
  };

  const key = name.toLowerCase();
  return map[key] || name || "(interaction)";
}

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

async function getTokenMetadata(
  tokenAddress: string,
  provider: ethers.Provider,
) {
  const key = tokenAddress.toLowerCase();

  if (TOKEN_CACHE.has(key)) {
    return TOKEN_CACHE.get(key)!;
  }

  const ERC20_ABI = [
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
  ];

  const tokenContract = new ethers.Contract(
    tokenAddress,
    ERC20_ABI,
    provider,
  ) as any;
  
  const decimals = await (tokenContract as any).decimals().catch(() => 18);

  const symbol = await (tokenContract as any)
    .symbol()
    .catch(() => shortAddress(tokenAddress));

  const meta = {
    symbol,
    decimals,
  };

  TOKEN_CACHE.set(key, meta);

  return meta;
}

export function startListener() {
  if (!provider) {
    console.error("ALCHEMY_WS not set");
    return;
  }

  console.log("Blockchain listener running...");
  const wsProvider = provider; // capture non-null provider for async use

  wsProvider.on("block", async (blockNumber) => {
    console.log("New block:", blockNumber);

    try {
      const block = await wsProvider.getBlock(blockNumber, true);

      if (!block || !block.transactions) return;

      // limit concurrent RPC calls to avoid hitting provider throughput limits
      const MAX_CONCURRENT_FETCH =
        Number(process.env.MAX_CONCURRENT_FETCH) || 5;
      let currentFetches = 0;
      const fetchQueue: (() => void)[] = [];

      const acquire = () =>
        new Promise<void>((resolve) => {
          if (currentFetches < MAX_CONCURRENT_FETCH) {
            currentFetches++;
            resolve();
            return;
          }
          fetchQueue.push(() => {
            currentFetches++;
            resolve();
          });
        });

      const release = () => {
        currentFetches = Math.max(0, currentFetches - 1);
        const next = fetchQueue.shift();
        if (next) next();
      };

      async function fetchTransactionWithRetry(hash: string) {
        const MAX_RETRIES = 3;
        let attempt = 0;
        let lastErr: any = null;

        while (attempt < MAX_RETRIES) {
          attempt++;
          try {
            await acquire();
            const tx = await wsProvider.getTransaction(hash);
            release();
            return tx;
          } catch (err) {
            release();
            lastErr = err;
            const waitMs = 500 * Math.pow(2, attempt - 1);
            console.warn(
              `getTransaction attempt ${attempt} failed, retrying in ${waitMs}ms`,
            );
            await new Promise((r) => setTimeout(r, waitMs));
          }
        }

        throw lastErr;
      }

      for (const txRaw of block.transactions) {
        let tx: any;

        // if txRaw is a hash string, fetch the full transaction (with rate-limit protection)
        if (typeof txRaw === "string") {
          try {
            tx = await fetchTransactionWithRetry(txRaw);
            if (!tx) continue;
          } catch (err) {
            console.error("Failed to fetch transaction:", err);
            continue;
          }
        } else {
          tx = txRaw as any;
        }

        // Always process the transaction so token transfers in receipts are detected
        // even when `from`/`to` are contract addresses.
        await Promise.all(
          block.transactions.map(async (txRaw) => {
            let tx: any;

            if (typeof txRaw === "string") {
              try {
                tx = await fetchTransactionWithRetry(txRaw);
                if (!tx) return;
              } catch (err) {
                console.error("Failed to fetch transaction:", err);
                return;
              }
            } else {
              tx = txRaw;
            }

            await handleTx(tx);
          }),
        );
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

  const selector = tx.data && tx.data.length >= 10 ? tx.data.slice(0, 10) : "";
  async function resolveSelector(sig: string) {
    if (!sig) return "(none)";
    if (KNOWN_SELECTORS[sig]) return KNOWN_SELECTORS[sig];

    try {
      const res = await (globalThis as any).fetch(
        `https://www.4byte.directory/api/v1/signatures/?hex_signature=${sig}`,
      );
      if (!res || !res.ok) return sig;
      const data = await res.json();
      if (data && Array.isArray(data.results) && data.results.length > 0) {
        return data.results[0].text_signature || sig;
      }
    } catch (e) {
      // ignore lookup errors and return raw selector
    }

    return sig;
  }

  let action = await resolveSelector(selector);

  // native transfer fallback
  if ((!selector || selector === "0x") && tx.value && tx.value > 0n) {
    action = "transfer";
  }

  // Attempt to decode calldata into a readable action with parameters
  let decodedAction = action;
  try {
    if (action && action.includes("(") && action !== "(none)") {
      const abiEntry = `function ${action}`;
      const iface = new ethers.Interface([abiEntry]);
      const parsed = iface.parseTransaction({ data: tx.data, value: tx.value });
      if (parsed) {
        const parts: string[] = [];
        const parsedAny = parsed as any;
        const inputs = parsedAny.functionFragment?.inputs || [];
        for (let i = 0; i < inputs.length; i++) {
          const input = inputs[i];
          const val = parsedAny.args?.[i];
          if (!input) continue;

          if (String(input.type).startsWith("address")) {
            parts.push(`${input.name || "addr"}: ${shortAddress(String(val))}`);
          } else if (
            /^uint/.test(String(input.type)) ||
            /^int/.test(String(input.type))
          ) {
            parts.push(`${input.name || "num"}: ${String(val)}`);
          } else {
            parts.push(`${input.name || "param"}: ${String(val)}`);
          }
        }

        const parsedName =
          parsedAny.name || parsedAny.functionFragment?.name || action;
        decodedAction = `${parsedName}(${parts.join(", ")})`;
      }
    }
  } catch (e) {
    // decoding failed — keep raw action
  }

  // prefetch receipt/transfers so alerts can include token outputs
  let transfers: any[] = [];
  try {
    if (provider) {
      const wsProvider = provider;
      const receipt = await wsProvider.getTransactionReceipt(tx.hash);
      if (receipt) {
        transfers = parseERC20Transfers(receipt);
      }
    }
  } catch (e) {
    // ignore receipt errors
  }

  const category = classifyAction(decodedAction || action || "");

  if (from && await isTracked(from)) {
    console.log("MATCH FROM:", from);

    const chatIds = await getChatIdsForWallet(from);

    const amount = formatEth(tx.value);
    const direction = category;
    const trackedWallet = from;

    const toDisplay = resolveName(to || "");

    let lines: string[] = [];
    lines.push(direction);
    lines.push("");
    lines.push(`Wallet:\n${shortAddress(trackedWallet)}`);

    if (amount !== "0") {
      lines.push("");
      lines.push(`Spent:\n${amount} ETH`);
    } else if (transfers.length > 0) {
      lines.push("");
      lines.push("Value:\nContract interaction");
    }

    lines.push("");
    lines.push(`To:\n${toDisplay}`);

    // token summaries
    type TransferSummary = {
      symbol: string;
      amount: string;
    };

    const sold: TransferSummary[] = [];
    const bought: TransferSummary[] = [];

    for (const t of transfers) {
      try {
        const meta = await getTokenMetadata(
          t.token,
          provider as ethers.Provider,
        );

        const amount = ethers.formatUnits(t.amount, meta.decimals);

        const formatted = Number(parseFloat(amount).toFixed(6)).toString();

        // outgoing
        if ((t.from || "").toLowerCase() === trackedWallet.toLowerCase()) {
          sold.push({
            symbol: meta.symbol,
            amount: formatted,
          });
        }

        // incoming
        if ((t.to || "").toLowerCase() === trackedWallet.toLowerCase()) {
          bought.push({
            symbol: meta.symbol,
            amount: formatted,
          });
        }
      } catch (e) {
        console.error("Transfer summarize error:", e);
      }
    }

    const soldText = sold.map((s) => `${s.amount} ${s.symbol}`).join(", ");

    const boughtText = bought.map((b) => `${b.amount} ${b.symbol}`).join(", ");

    // SWAP
    if (sold.length && bought.length) {
      lines[0] = "🟣 SWAP DETECTED";

      lines.push("");
      lines.push(`Sold:\n${soldText}`);

      lines.push("");
      lines.push(`Bought:\n${boughtText}`);
    }

    // TOKEN SENT
    else if (sold.length) {
      lines[0] = "🔴 TOKEN SENT";

      lines.push("");
      lines.push(`Sent:\n${soldText}`);
    }

    // TOKEN RECEIVED
    else if (bought.length) {
      lines[0] = "🟢 TOKEN RECEIVED";

      lines.push("");
      lines.push(`Received:\n${boughtText}`);
    }

    lines.push("");
    lines.push(`Action:\n${decodedAction}`);
    lines.push("");
    lines.push(`Tx:\n${EXPLORER_BASE}${tx.hash}`);

    const message = lines.join("\n");
    chatIds.forEach((chatId: number) => sendAlert(chatId, message));
  }

  if (to && await isTracked(to)) {
    console.log("MATCH TO:", to);

    const chatIds = await getChatIdsForWallet(to);

    const amount = formatEth(tx.value);
    const direction = "🔴 INCOMING TRANSACTION";
    const trackedWallet = to;

    const fromDisplay = from || "(contract)";

    const message = `${direction}\n\nWallet:\n${shortAddress(trackedWallet)}\n\nAmount:\n${amount} ETH\n\nFrom:\n${shortAddress(fromDisplay)}\n\nTx:\n${EXPLORER_BASE}${tx.hash}`;
    const messageWithAction = message.replace(
      "\n\nTx:",
      `\n\nAction:\n${decodedAction}\n\nTx:`,
    );

    chatIds.forEach((chatId: number) => sendAlert(chatId, messageWithAction));
  }

  // Token transfers already included in summaries above; skip separate alerts to avoid duplication.
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
