import { SIM_TRANSACTION_TYPE } from "../enums/sim.enum";
import { Prisma } from "../generated/prisma";
import { prisma } from "../lib/db";
import { BalanceUpdateDto, ChatDto } from "../validations/chat.dto";

export const createChatWithDeviceSims = async (dto: ChatDto) => {
  const { telegramChatId, title, deviceNo, sims } = dto;
  const existingChat = await prisma.chat.findUnique({
    where: { telegramChatId },
    select: { id: true, title: true, chatDevices: true },
  });
  const existingDevice = await prisma.device.findUnique({
    where: { deviceNo },
    select: { id: true, deviceNo: true, sims: true },
  });

  return await prisma.$transaction(async (tx) => {
    if (existingChat) {
      if (existingDevice) {
        const chatDevice = existingChat.chatDevices.find((cd) => cd.deviceId === existingDevice.id);
        if (!chatDevice) {
          // Link existing device to existing chat
          await tx.chatDevice.create({
            data: { chatId: existingChat.id, deviceId: existingDevice.id },
          });
        }
        // Unlink device sims that are not in the new sims list
        const simsMap = new Map(sims.map((s) => [s.phone, s.simNo]));
        const simsToUnlink = existingDevice.sims.filter((s) => !simsMap.has(s.phone));
        for (const sim of simsToUnlink) {
          await tx.sim.update({ where: { id: sim.id }, data: { deviceId: null } });
        }

        // Device already linked to chat, just update sims and title if needed
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
        const device = await tx.device.create({ data: { deviceNo } });
        // Link new device to existing chat
        await tx.chatDevice.create({ data: { chatId: existingChat.id, deviceId: device.id } });

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
      if (existingDevice) {
        // Link existing device to new chat
        await tx.chatDevice.create({
          data: { chatId: chat.id, deviceId: existingDevice.id },
        });

        // unlink device sims that are not in the new sims list
        const simsMap = new Map(sims.map((s) => [s.phone, s.simNo]));
        const simsToUnlink = existingDevice.sims.filter((s) => !simsMap.has(s.phone));
        for (const sim of simsToUnlink) {
          await tx.sim.update({ where: { id: sim.id }, data: { deviceId: null } });
        }

        for (const sim of sims) {
          await tx.sim.upsert({
            where: { phone: sim.phone },
            update: { ...sim, deviceId: existingDevice.id },
            create: { ...sim, deviceId: existingDevice.id },
          });
        }
        return true;
      } else {
        const device = await tx.device.create({ data: { deviceNo } });
        // Link new device to new chat
        await tx.chatDevice.create({ data: { chatId: chat.id, deviceId: device.id } });

        for (const sim of sims) {
          await tx.sim.upsert({
            where: { phone: sim.phone },
            update: { ...sim, deviceId: device.id },
            create: { ...sim, deviceId: device.id },
          });
        }
        return true;
      }
    }
  });
};

export const getChatByTelegramChatId = async (telegramChatId: string) => {
  return await prisma.chat.findUnique({
    where: { telegramChatId },
    select: {
      chatDevices: {
        include: { device: { include: { sims: { orderBy: { simNo: "asc" } } } } },
        orderBy: { device: { deviceNo: "asc" } },
      },
    },
  });
};

export const deleteChatByTelegramChatId = async (telegramChatId: string) => {
  const chat = await prisma.chat.findUnique({
    where: { telegramChatId },
    select: { id: true, chatDevices: { include: { device: { include: { sims: true } } } } },
  });
  if (!chat) throw new Error("Chat not found", { cause: "NOT_FOUND" });

  const simIDs = chat.chatDevices.flatMap((chatDevice) => chatDevice.device.sims.map((s) => s.id));

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
      chatDevices: {
        include: { device: { include: { sims: { orderBy: { simNo: "asc" } } } } },
        orderBy: { device: { deviceNo: "asc" } },
      },
    },
  });

  if (!chat) throw new Error("Chat not found", { cause: "NOT_FOUND" });
  if (!chat.chatDevices.length)
    throw new Error("No devices found for this chat", { cause: "NOT_FOUND" });

  const device = chat.chatDevices.find((cd) => cd.device.deviceNo === dto.deviceNo)?.device;
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

  return await prisma.$transaction(async (tx) => {
    const transaction = await tx.simTransactionHistory.create({
      data: {
        simId: sim.id,
        amount: dto.amount,
        charge: 0,
        operation: dto.walletType.toUpperCase(),
        type: dto.amount > 0 ? SIM_TRANSACTION_TYPE.IN : SIM_TRANSACTION_TYPE.OUT,
        note: `Group: ${chat.title}, By: ${username}`,
      },
    });
    await tx.sim.update({ where: { id: sim.id }, data: updatePayload });

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
      chatDevices: { include: { device: { include: { sims: { orderBy: { simNo: "asc" } } } } } },
    },
  });

  if (!chat) throw new Error("Chat not found", { cause: "NOT_FOUND" });
  if (!chat.chatDevices.length)
    throw new Error("No devices found for this chat", { cause: "NOT_FOUND" });

  const device = chat.chatDevices.find((cd) => cd.device.deviceNo === dto.deviceNo)?.device;
  if (!device) throw new Error("Device not found for this chat", { cause: "NOT_FOUND" });

  const sim = device.sims.find((s) => s.simNo === dto.simNo);
  if (!sim) throw new Error("Sim not found for this device", { cause: "NOT_FOUND" });

  if (dto.walletType === "bk") sim.bkLimit += dto.amount;
  else sim.ngLimit += dto.amount;

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
      chatDevices: { include: { device: true } },
    },
  });

  if (!chat) throw new Error("Chat not found", { cause: "NOT_FOUND" });

  const chatDevice = chat.chatDevices.find((cd) => cd.device.deviceNo === deviceNo);
  if (!chatDevice) throw new Error("Device not found for this chat", { cause: "NOT_FOUND" });

  await prisma.chatDevice.delete({ where: { id: chatDevice.id } });

  return true;
};
