const trackedWallets = new Set<string>();

export function addWallet(wallet: string) {
  trackedWallets.add(wallet.toLowerCase());
}

export function getWallets() {
  return Array.from(trackedWallets);
}

export function isTracked(wallet: string) {
  return trackedWallets.has(wallet.toLowerCase());
}