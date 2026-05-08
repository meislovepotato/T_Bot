const trackedWallets: Map<string, Set<number>> = new Map();

export function addWallet(chatId: number, wallet: string) {
  const key = wallet.toLowerCase();
  const set = trackedWallets.get(key) || new Set<number>();
  set.add(chatId);
  trackedWallets.set(key, set);
  console.log(`Tracking wallet ${key} for chat ${chatId}`);
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
