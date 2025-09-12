import { z } from "zod";

export const simSchema = z.object({
  simNo: z.int(),
  phone: z.string(),
  bkLimit: z.number(),
  ngLimit: z.number(),
});

export type SimDto = z.infer<typeof simSchema>;

export const chatSchema = z.object({
  telegramChatId: z.string(),
  title: z.string(),
  deviceNo: z.int(),
  sims: z.array(simSchema),
});

export type ChatDto = z.infer<typeof chatSchema>;

export const balanceUpdateSchema = z.object({
  deviceNo: z.int(),
  simNo: z.int(),
  amount: z.number(),
  walletType: z.string(),
});

export type BalanceUpdateDto = z.infer<typeof balanceUpdateSchema>;
