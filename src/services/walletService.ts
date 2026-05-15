import { prisma } from "../lib/prisma";

const MAX_WALLETS_PER_USER = 10;

export async function addWallet(chatId: number, wallet: string) {
  const key = wallet.toLowerCase();

  // find user
  let user = await prisma.user.findUnique({
    where: {
      chatId: BigInt(chatId),
    },
    include: {
      wallets: true,
    },
  });

  // create user if not exists
  if (!user) {
    user = await prisma.user.create({
      data: {
        chatId: BigInt(chatId),
      },
      include: {
        wallets: true,
      },
    });
  }

  // wallet limit
  if (user.wallets.length >= MAX_WALLETS_PER_USER) {
    return {
      success: false,
      message: `You can only track up to ${MAX_WALLETS_PER_USER} wallets.`,
    };
  }

  // duplicate check
  const existing = user.wallets.find((w: { address: string }) => w.address.toLowerCase() === key);

  if (existing) {
    return {
      success: false,
      message: "Wallet is already being tracked.",
    };
  }

  // create wallet
  await prisma.wallet.create({
    data: {
      address: key,
      userId: user.id,
    },
  });

  console.log(`Tracking wallet ${key} for chat ${chatId}`);

  return {
    success: true,
    message: "Wallet added successfully.",
  };
}

export async function removeWallet(chatId: number, wallet: string) {
  const key = wallet.toLowerCase();

  const user = await prisma.user.findUnique({
    where: {
      chatId: BigInt(chatId),
    },
  });

  if (!user) {
    return {
      success: false,
      message: "User not found.",
    };
  }

  const existing = await prisma.wallet.findFirst({
    where: {
      address: key,
      userId: user.id,
    },
  });

  if (!existing) {
    return {
      success: false,
      message: "Wallet is not being tracked.",
    };
  }

  await prisma.wallet.delete({
    where: {
      id: existing.id,
    },
  });

  console.log(`Removed wallet ${key} for chat ${chatId}`);

  return {
    success: true,
    message: "Wallet removed successfully.",
  };
}

export async function getWallets() {
  const wallets = await prisma.wallet.findMany();

  return wallets.map((w: { address: string }) => w.address);
}

export async function getChatIdsForWallet(wallet: string) {
  const rows = await prisma.wallet.findMany({
    where: {
      address: wallet.toLowerCase(),
    },
    include: {
      user: true,
    },
  });

  return rows.map((r: { user: { chatId: bigint } }) => Number(r.user.chatId));
}

export async function getWalletsForChat(chatId: number) {
  const user = await prisma.user.findUnique({
    where: {
      chatId: BigInt(chatId),
    },
    include: {
      wallets: true,
    },
  });

  if (!user) return [];

  return user.wallets.map((w: { address: string }) => w.address);
}

export async function isTracked(wallet: string) {
  const count = await prisma.wallet.count({
    where: {
      address: wallet.toLowerCase(),
    },
  });

  return count > 0;
}
