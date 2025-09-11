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
