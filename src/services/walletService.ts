const trackedWallets: Map<string, Set<number>> = new Map();

const MAX_WALLETS_PER_USER = 10;

export function addWallet(chatId: number, wallet: string) {
  const key = wallet.toLowerCase();

  const userWallets = getWalletsForChat(chatId);

  // limit wallets per user
  if (userWallets.length >= MAX_WALLETS_PER_USER) {
    return {
      success: false,
      message: `You can only track up to ${MAX_WALLETS_PER_USER} wallets.`,
    };
  }

  // prevent duplicates
  if (userWallets.includes(key)) {
    return {
      success: false,
      message: "Wallet is already being tracked.",
    };
  }
  const set = trackedWallets.get(key) || new Set<number>();

  set.add(chatId);

  trackedWallets.set(key, set);

  console.log(`Tracking wallet ${key} for chat ${chatId}`);

  return {
    success: true,
    message: "Wallet added successfully.",
  };
}

export function removeWallet(chatId: number, wallet: string) {
  const key = wallet.toLowerCase();

  const set = trackedWallets.get(key);

  if (!set || !set.has(chatId)) {
    return {
      success: false,
      message: "Wallet is not being tracked.",
    };
  }

  set.delete(chatId);

  // cleanup empty sets
  if (set.size === 0) {
    trackedWallets.delete(key);
  }

  console.log(`Removed wallet ${key} for chat ${chatId}`);

  return {
    success: true,
    message: "Wallet removed successfully.",
  };
}


export function getWallets() {
  return Array.from(trackedWallets.keys());
}

export function getChatIdsForWallet(wallet: string) {
  return Array.from(trackedWallets.get(wallet.toLowerCase()) || []);
}

export function getWalletsForChat(chatId: number) {
  const wallets: string[] = [];
  for (const [wallet, set] of trackedWallets.entries()) {
    if (set.has(chatId)) wallets.push(wallet);
  }
  return wallets;
}

export function isTracked(wallet: string) {
  return trackedWallets.has(wallet.toLowerCase());
}
