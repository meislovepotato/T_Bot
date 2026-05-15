import { z } from "zod";

const envSchema = z.object({
  BOT_TOKEN: z.string().min(1),

  ALCHEMY_WS: z
    .string()
    .url(),

  EXPLORER_BASE: z
    .string()
    .url()
    .default("https://basescan.org/tx/"),
});

export const env = envSchema.parse(process.env);