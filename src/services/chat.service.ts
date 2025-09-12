import { SIM_TRANSACTION_TYPE } from "../enums/sim.enum";
import { Prisma } from "../generated/prisma";
import { prisma } from "../lib/db";
import { DeviceSimData, formatDeviceData } from "../utils/formatDeviceData";
import { BalanceUpdateDto, ChatDto } from "../validations/chat.dto";

export const createChatWithDeviceSims = async (dto: ChatDto) => {
  const { telegramChatId, title, deviceNo, sims } = dto;
  const existingChat = await prisma.chat.findUnique({
    where: { telegramChatId },
    include: { devices: { include: { deviceSims: true } } },
  });
  if (existingChat && existingChat.devices.length) {
    const existingDevice = existingChat.devices.find((device) => device.deviceNo === deviceNo);
    if (existingDevice) {
    }
  }
  return await prisma.chat.create({ data: { telegramChatId, title } });
};

export const getChatTelegramChatId = async (telegramChatId: string) => {
  return await prisma.chat.findUnique({
    where: { telegramChatId },
    select: {
      devices: { include: { deviceSims: { include: { sim: true }, orderBy: { simNo: "asc" } } } },
    },
  });
};

export const deleteChatByTelegramChatId = async (telegramChatId: string) => {
  return await prisma.chat.delete({ where: { telegramChatId } });
};

export const updateBalance = async (telegramChatId: string, dto: BalanceUpdateDto) => {
  const chat = await prisma.chat.findUnique({
    where: { telegramChatId },
    select: {
      title: true,
      devices: { include: { deviceSims: { include: { sim: true }, orderBy: { simNo: "asc" } } } },
    },
  });

  if (!chat) throw new Error("Chat not found");
  if (!chat.devices.length) throw new Error("No devices found for this chat");

  const device = chat.devices.find((d) => d.deviceNo === dto.deviceNo);
  if (!device) throw new Error("Device not found for this chat");

  const sim = device.deviceSims.find((s) => s.simNo === dto.simNo);
  if (!sim) throw new Error("Sim not found for this device");

  if (dto.walletType === "bk") sim.sim.bkLimit -= dto.amount;
  else sim.sim.ngLimit -= dto.amount;

  const updatePayload: Prisma.SimUncheckedUpdateInput =
    dto.walletType === "bk"
      ? { bkBalance: { increment: dto.amount }, bkLimit: { decrement: dto.amount } }
      : { ngBalance: { increment: dto.amount }, ngLimit: { decrement: dto.amount } };

  return await prisma.$transaction(async (tx) => {
    const [transaction] = await Promise.all([
      tx.simTransactionHistory.create({
        data: {
          simId: sim.simId,
          amount: dto.amount,
          charge: 0,
          operation: "SM",
          type: dto.amount > 0 ? SIM_TRANSACTION_TYPE.IN : SIM_TRANSACTION_TYPE.OUT,
          note: `${dto.amount > 0 ? "Credited" : "Debited"} via bot by group: ${chat.title}`,
        },
      }),
      tx.sim.update({ where: { id: sim.simId }, data: updatePayload }),
    ]);
    return { transactionId: transaction.id, ...chat };
  });
};

export const undoBalance = async (
  telegramChatId: string,
  dto: BalanceUpdateDto & { transactionId: number }
) => {
  const chat = await prisma.chat.findUnique({
    where: { telegramChatId },
    select: {
      title: true,
      devices: { include: { deviceSims: { include: { sim: true }, orderBy: { simNo: "asc" } } } },
    },
  });

  if (!chat) throw new Error("Chat not found");
  if (!chat.devices.length) throw new Error("No devices found for this chat");

  const device = chat.devices.find((d) => d.deviceNo === dto.deviceNo);
  if (!device) throw new Error("Device not found for this chat");

  const sim = device.deviceSims.find((s) => s.simNo === dto.simNo);
  if (!sim) throw new Error("Sim not found for this device");

  if (dto.walletType === "bk") sim.sim.bkLimit += dto.amount;
  else sim.sim.ngLimit += dto.amount;

  const updatePayload: Prisma.SimUncheckedUpdateInput =
    dto.walletType === "bk"
      ? { bkBalance: { decrement: dto.amount }, bkLimit: { increment: dto.amount } }
      : { ngBalance: { decrement: dto.amount }, ngLimit: { increment: dto.amount } };

  await prisma.$transaction(async (tx) => {
    await Promise.all([
      tx.sim.update({ where: { id: sim.simId }, data: updatePayload }),
      tx.simTransactionHistory.delete({ where: { id: dto.transactionId } }),
    ]);
  });

  return chat;
};

const demoData: DeviceSimData = {
  devices: [
    {
      id: 1,
      createdAt: new Date("2023-01-01"),
      updatedAt: new Date("2023-01-15"),
      deviceNo: 1,
      chatId: 1,
      deviceSims: [
        {
          id: 1,
          simNo: 1,
          deviceId: 1,
          simId: 1,
          sim: {
            id: 1,
            createdAt: new Date("2023-01-01"),
            updatedAt: new Date("2023-01-15"),
            phone: "01832553404",
            bkLimit: 80000,
            ngLimit: 80000,
            bkBalance: 0,
            ngBalance: 0,
            bkMonthlyUsed: 0,
            ngMonthlyUsed: 0,
          },
        },
        {
          id: 2,
          simNo: 2,
          deviceId: 1,
          simId: 2,
          sim: {
            id: 2,
            createdAt: new Date("2023-01-01"),
            updatedAt: new Date("2023-01-15"),
            phone: "01830368041",
            bkLimit: 80000,
            ngLimit: 0,
            bkBalance: 0,
            ngBalance: 0,
            bkMonthlyUsed: 0,
            ngMonthlyUsed: 0,
          },
        },
      ],
    },
    {
      id: 1,
      createdAt: new Date("2023-01-01"),
      updatedAt: new Date("2023-01-15"),
      deviceNo: 1,
      chatId: 1,
      deviceSims: [
        {
          id: 1,
          simNo: 1,
          deviceId: 1,
          simId: 1,
          sim: {
            id: 1,
            createdAt: new Date("2023-01-01"),
            updatedAt: new Date("2023-01-15"),
            phone: "01832553404",
            bkLimit: 80000,
            ngLimit: 80000,
            bkBalance: 0,
            ngBalance: 0,
            bkMonthlyUsed: 0,
            ngMonthlyUsed: 0,
          },
        },
        {
          id: 2,
          simNo: 2,
          deviceId: 1,
          simId: 2,
          sim: {
            id: 2,
            createdAt: new Date("2023-01-01"),
            updatedAt: new Date("2023-01-15"),
            phone: "01830368041",
            bkLimit: 80000,
            ngLimit: 0,
            bkBalance: 0,
            ngBalance: 0,
            bkMonthlyUsed: 0,
            ngMonthlyUsed: 0,
          },
        },
      ],
    },
  ],
};

console.log(formatDeviceData(demoData));
