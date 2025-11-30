import { SIM_TRANSACTION_TYPE } from "../enums/sim.enum";
import { Prisma } from "../generated/prisma";
import { prisma } from "../lib/db";
import { BalanceUpdateDto, ChatDto } from "../validations/chat.dto";

export const createChatWithDeviceSims = async (dto: ChatDto) => {
  const { telegramChatId, title, deviceNo, sims } = dto;
  const existingChat = await prisma.chat.findUnique({
    where: { telegramChatId },
    select: { id: true, title: true, devices: { include: { sims: true } } },
  });
  return await prisma.$transaction(async (tx) => {
    if (existingChat && existingChat.devices.length) {
      const existingDevice = existingChat.devices.find((device) => device.deviceNo === deviceNo);
      if (existingDevice) {
        for (const sim of sims) {
          await tx.sim.upsert({
            where: { phone: sim.phone },
            update: { ...sim, deviceId: existingDevice.id },
            create: { ...sim, deviceId: existingDevice.id },
          });
        }
        if (existingChat.title !== title) {
          await tx.chat.update({ where: { id: existingChat.id }, data: { title } });
        }

        return true;
      } else {
        const device = await tx.device.create({ data: { deviceNo, chatId: existingChat.id } });
        for (const sim of sims) {
          await tx.sim.upsert({
            where: { phone: sim.phone },
            update: { ...sim, deviceId: device.id },
            create: { ...sim, deviceId: device.id },
          });
        }
        if (existingChat.title !== title) {
          await tx.chat.update({ where: { id: existingChat.id }, data: { title } });
        }

        return true;
      }
    } else {
      const chat = await tx.chat.create({ data: { telegramChatId, title } });
      const device = await tx.device.create({ data: { deviceNo, chatId: chat.id } });

      for (const sim of sims) {
        await tx.sim.upsert({
          where: { phone: sim.phone },
          update: { ...sim, deviceId: device.id },
          create: { ...sim, deviceId: device.id },
        });
      }
      return true;
    }
  });
};

export const getChatByTelegramChatId = async (telegramChatId: string) => {
  return await prisma.chat.findUnique({
    where: { telegramChatId },
    select: {
      devices: {
        include: { sims: { orderBy: { simNo: "asc" } } },
        orderBy: { deviceNo: "asc" },
      },
    },
  });
};

export const deleteChatByTelegramChatId = async (telegramChatId: string) => {
  const chat = await prisma.chat.findUnique({
    where: { telegramChatId },
    select: { id: true, devices: { include: { sims: true } } },
  });
  if (!chat) throw new Error("Chat not found", { cause: "NOT_FOUND" });

  const simIDs = chat.devices.flatMap((d) => d.sims.map((s) => s.id));

  return await prisma.$transaction(async (tx) => {
    await Promise.all([
      tx.chat.delete({ where: { telegramChatId } }),
      tx.sim.updateMany({
        where: { id: { in: simIDs } },
        data: {
          bkBalance: 0,
          ngBalance: 0,
          bkLimit: 0,
          ngLimit: 0,
          bkSM: 0,
          bkCO: 0,
          bkMER: 0,
          ngSM: 0,
          ngCO: 0,
          ngMER: 0,
        },
      }),
    ]);
  });
};

export const updateBalance = async (
  telegramChatId: string,
  username: string,
  dto: BalanceUpdateDto
) => {
  const chat = await prisma.chat.findUnique({
    where: { telegramChatId },
    select: {
      title: true,
      devices: {
        include: { sims: { orderBy: { simNo: "asc" } } },
        orderBy: { deviceNo: "asc" },
      },
    },
  });

  if (!chat) throw new Error("Chat not found", { cause: "NOT_FOUND" });
  if (!chat.devices.length)
    throw new Error("No devices found for this chat", { cause: "NOT_FOUND" });

  const device = chat.devices.find((d) => d.deviceNo === dto.deviceNo);
  if (!device) throw new Error("Device not found for this chat", { cause: "NOT_FOUND" });

  const sim = device.sims.find((s) => s.simNo === dto.simNo);
  if (!sim) throw new Error("Sim not found for this device", { cause: "NOT_FOUND" });

  if (dto.walletType === "bk") sim.bkLimit -= dto.amount;
  else sim.ngLimit -= dto.amount;

  const updatePayload: Prisma.SimUncheckedUpdateInput =
    dto.walletType === "bk"
      ? { bkBalance: { increment: dto.amount }, bkLimit: { decrement: dto.amount } }
      : { ngBalance: { increment: dto.amount }, ngLimit: { decrement: dto.amount } };
  updatePayload.lastCashedInDate = new Date();
  chat.devices = device ? [device] : [];

  return await prisma.$transaction(async (tx) => {
    const [transaction] = await Promise.all([
      tx.simTransactionHistory.create({
        data: {
          simId: sim.id,
          amount: dto.amount,
          charge: 0,
          operation: dto.walletType.toUpperCase(),
          type: dto.amount > 0 ? SIM_TRANSACTION_TYPE.IN : SIM_TRANSACTION_TYPE.OUT,
          note: `Group: ${chat.title}, By: ${username}`,
        },
      }),
      tx.sim.update({ where: { id: sim.id }, data: updatePayload }),
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
      devices: { include: { sims: { orderBy: { simNo: "asc" } } } },
    },
  });

  if (!chat) throw new Error("Chat not found", { cause: "NOT_FOUND" });
  if (!chat.devices.length)
    throw new Error("No devices found for this chat", { cause: "NOT_FOUND" });

  const device = chat.devices.find((d) => d.deviceNo === dto.deviceNo);
  if (!device) throw new Error("Device not found for this chat", { cause: "NOT_FOUND" });

  const sim = device.sims.find((s) => s.simNo === dto.simNo);
  if (!sim) throw new Error("Sim not found for this device", { cause: "NOT_FOUND" });

  if (dto.walletType === "bk") sim.bkLimit += dto.amount;
  else sim.ngLimit += dto.amount;

  chat.devices = device ? [device] : [];

  const updatePayload: Prisma.SimUncheckedUpdateInput =
    dto.walletType === "bk"
      ? { bkBalance: { decrement: dto.amount }, bkLimit: { increment: dto.amount } }
      : { ngBalance: { decrement: dto.amount }, ngLimit: { increment: dto.amount } };
  updatePayload.lastCashedInDate = new Date();

  await prisma.$transaction(async (tx) => {
    await Promise.all([
      tx.sim.update({ where: { id: sim.id }, data: updatePayload }),
      tx.simTransactionHistory.delete({ where: { id: dto.transactionId } }),
    ]);
  });

  return chat;
};

export const removeDeviceFromChat = async (telegramChatId: string, deviceNo: number) => {
  const chat = await prisma.chat.findUnique({
    where: { telegramChatId },
    select: {
      id: true,
      devices: {
        where: { deviceNo },
        include: { sims: true },
      },
    },
  });

  if (!chat) throw new Error("Chat not found", { cause: "NOT_FOUND" });

  const device = chat.devices.find((d) => d.deviceNo === deviceNo);
  if (!device) throw new Error("Device not found for this chat", { cause: "NOT_FOUND" });

  await prisma.device.delete({ where: { id: device.id } });

  return true;
};
