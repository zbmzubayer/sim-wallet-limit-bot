import { prisma } from "../lib/db";

export const createBotUser = async (telegramUsername: string) => {
  return prisma.botUser.create({
    data: { telegramUsername },
  });
};

export const getAllBotUsers = async () => {
  return prisma.botUser.findMany({ select: { telegramUsername: true } });
};

export const getBotUserByUsername = async (telegramUsername: string) => {
  return prisma.botUser.findUnique({
    where: { telegramUsername },
  });
};

export const deleteBotUserByUsername = async (telegramUsername: string) => {
  return prisma.botUser.delete({
    where: { telegramUsername },
  });
};
