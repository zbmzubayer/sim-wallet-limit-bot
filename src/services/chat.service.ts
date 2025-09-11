import { prisma } from "../lib/db";
import { ChatDto } from "../validations/chat.dto";

export const createChatWithDeviceSims = async (chatDto: ChatDto) => {
  const existingChat = await prisma.chat.findUnique({
    where: { telegramChatId: chatDto.telegramChatId },
    include: { devices: { include: { sims: true } } },
  });
  if (existingChat) {
    if (existingChat.devices.length) {
      const existingDevice = existingChat.devices.find(
        (device) => device.deviceNo === chatDto.deviceNo
      );
      if (existingDevice) {
        // Update existing device's sims
      }
    }
  }
  return await prisma.chat.create({ data: chatDto });
};

export const getChatByTelegramChatId = async (telegramChatId: string) => {
  return await prisma.chat.findUnique({ where: { telegramChatId } });
};

export const deleteChatByTelegramChatId = async (telegramChatId: string) => {
  return await prisma.chat.delete({ where: { telegramChatId } });
};
