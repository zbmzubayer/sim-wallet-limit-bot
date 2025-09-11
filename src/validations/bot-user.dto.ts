import { z } from "zod";

export const botUserSchema = z.object({
  telegramUsername: z.string().min(1),
});

export type BotUserDto = z.infer<typeof botUserSchema>;
