import { Bot } from "grammy";
import { parseDeviceSet } from "./utils/parseDeviceSet";
import {
  createBotUser,
  deleteBotUserByUsername,
  getBotUserByUsername,
} from "./services/bot-user.service";
import { isAuthorized, isOwner } from "./services/auth.service";
import {
  createChatWithDeviceSims,
  deleteChatByTelegramChatId,
  getChatTelegramChatId,
  undoBalance,
  updateBalance,
} from "./services/chat.service";
import { formatDeviceData } from "./utils/formatDeviceData";
import { BalanceUpdateDto } from "./validations/chat.dto";

export function botCommand(bot: Bot) {
  // To keep track of last transactions for undo feature
  const transactionMap = new Map<string, Array<BalanceUpdateDto & { transactionId: number }>>(); // Key: telegramChatId

  // Set command
  bot.command("set", async (ctx) => {
    // Only owner and authorized users can set
    if (!isOwner(ctx.from?.id.toString() || "") && !isAuthorized(ctx.from?.username || "")) return;

    const deviceData = parseDeviceSet(ctx.match.trim());
    if (deviceData) {
      const telegramChatId = ctx.chat.id.toString();
      try {
        await createChatWithDeviceSims({
          telegramChatId,
          title: ctx.chat.title || "",
          deviceNo: deviceData.deviceNo,
          sims: deviceData.sims,
        });
        return ctx.reply("✅ Wallets have been set for this chat.", {
          reply_parameters: { message_id: ctx.message?.message_id! },
        });
      } catch (error) {
        console.error("Error setting wallets:", error);
        return ctx.reply("❌ Failed to set wallets for this chat.", {
          reply_parameters: { message_id: ctx.message?.message_id! },
        });
      }
    } else {
      return ctx.reply(
        `❌ Invalid wallet setup format. Please use the format below:
DS-1

Sim1 - 01000000001 BK 80K | NG 80K
Sim2 - 01000000002 BK 80K | NG 0K
Sim3 - 01000000003 BK 80K | NG 80K
Sim4 - 01000000004 BK 80K | NG 50K
`,
        { reply_parameters: { message_id: ctx.message?.message_id! } }
      );
    }
  });

  // Reset wallet command
  bot.command("reset", async (ctx) => {
    // Only owner and authorized users can set
    if (!isOwner(ctx.from?.id.toString() || "") && !isAuthorized(ctx.from?.username || "")) return;

    const telegramChatId = ctx.chat.id.toString();
    try {
      await deleteChatByTelegramChatId(telegramChatId);
      transactionMap.delete(telegramChatId); // Clear any stored transactions

      return ctx.reply("✅ Wallets have been reset for this chat.", {
        reply_parameters: { message_id: ctx.message?.message_id! },
      });
    } catch (error) {
      console.error("Error resetting wallets:", error);
      return ctx.reply("❌ No wallets found for this chat.", {
        reply_parameters: { message_id: ctx.message?.message_id! },
      });
    }
  });

  // Status command
  bot.command("status", async (ctx) => {
    // Only owner and authorized users can set
    if (!isOwner(ctx.from?.id.toString() || "") && !isAuthorized(ctx.from?.username || "")) return;

    const telegramChatId = ctx.chat.id.toString();
    try {
      const chatData = await getChatTelegramChatId(telegramChatId);
      if (!chatData) {
        return ctx.reply("⚠️ No wallets set yet for this chat", {
          reply_parameters: { message_id: ctx.message?.message_id! },
        });
      }
      const formattedOutput = formatDeviceData(chatData);
      return ctx.reply(formattedOutput, {
        reply_parameters: { message_id: ctx.message?.message_id! },
      });
    } catch (error) {
      console.error("Error fetching status:", error);
      return ctx.reply("❌ Failed to fetch status for this chat.", {
        reply_parameters: { message_id: ctx.message?.message_id! },
      });
    }
  });

  // Undo command
  bot.command("undo", async (ctx) => {
    // Only owner and authorized users can set
    if (!isOwner(ctx.from?.id.toString() || "") && !isAuthorized(ctx.from?.username || "")) return;

    const telegramChatId = ctx.chat.id.toString();
    const transactions = transactionMap.get(telegramChatId);
    if (!transactions || transactions.length === 0) {
      return ctx.reply("⚠️ No transactions to undo", {
        reply_parameters: { message_id: ctx.message?.message_id! },
      });
    }
    const lastTransaction = transactions.pop()!;
    try {
      await undoBalance(telegramChatId, {
        deviceNo: lastTransaction.deviceNo,
        simNo: lastTransaction.simNo,
        amount: -lastTransaction.amount, // Revert the amount
        walletType: lastTransaction.walletType,
        transactionId: lastTransaction.transactionId,
      });
      transactionMap.set(telegramChatId, transactions); // Update the map
      return ctx.reply("🔙 Last transaction has been undone", {
        reply_parameters: { message_id: ctx.message?.message_id! },
      });
    } catch (error) {
      console.error("Error updating balance:", error);
      if (error instanceof Error && error.cause === "NOT_FOUND") {
        return ctx.reply("❌ No wallets found for this chat.", {
          reply_parameters: { message_id: ctx.message?.message_id! },
        });
      }
      return ctx.reply("❌ Failed to undo the last transaction.", {
        reply_parameters: { message_id: ctx.message?.message_id! },
      });
    }
  });

  // AddUser command
  bot.command("addUser", async (ctx) => {
    // Only owner can add user
    if (!isOwner(ctx.from?.id.toString() || "")) return;

    const username = ctx.match.trim();
    if (!username) return ctx.reply("❌ Please provide a valid username.");
    const isUserExist = await getBotUserByUsername(username);
    if (isUserExist) {
      return ctx.reply("✅ User already exists.", {
        reply_parameters: { message_id: ctx.message?.message_id! },
      });
    } else {
      await createBotUser(username); // create the user in DB
      return ctx.reply(`✅ User ${username} has been added successfully.`, {
        reply_parameters: { message_id: ctx.message?.message_id! },
      });
    }
  });

  // RemoveUser command
  bot.command("removeUser", async (ctx) => {
    // Only owner can remove user
    if (!isOwner(ctx.from?.id.toString() || "")) return;

    const username = ctx.match.trim();
    if (!username) return ctx.reply("❌ Please provide a valid username.");
    const isUserExist = await getBotUserByUsername(username);
    if (!isUserExist) {
      return ctx.reply("❌ User does not exist.", {
        reply_parameters: { message_id: ctx.message?.message_id! },
      });
    } else {
      await deleteBotUserByUsername(username); // Delete user in DB
      return ctx.reply(`\uf235\nUser ${username} has been removed successfully.`, {
        reply_parameters: { message_id: ctx.message?.message_id! },
      });
    }
  });

  bot.on("message:text", async (ctx) => {
    // Only owner and authorized users can set
    if (!isOwner(ctx.from?.id.toString() || "") && !isAuthorized(ctx.from?.username || "")) return;

    const regex = /^([+-]\d+)\s+ds-(\d+)\s+sim([1-4])\s+(bk|ng)$/i;
    const match = ctx.message.text.match(regex);

    if (!match)
      return ctx.reply("❌ Invalid format. Use: +30000 ds-1 sim1 bk", {
        reply_parameters: { message_id: ctx.message?.message_id! },
      });
    if (!match[1] || !match[2] || !match[3] || !match[4]) {
      return ctx.reply("❌ Invalid format. Use: +30000 ds-1 sim1 bk", {
        reply_parameters: { message_id: ctx.message?.message_id! },
      });
    }

    const amount = parseInt(match[1], 10);
    const deviceNo = parseInt(match[2], 10);
    const simNo = parseInt(match[3], 10);
    const walletType = match[4]?.toLowerCase();
    const telegramChatId = ctx.chat.id.toString();
    const payload = { deviceNo, simNo, amount, walletType };

    try {
      const { transactionId, ...chat } = await updateBalance(telegramChatId, payload);

      // Store the transaction for potential undo
      const transactions = transactionMap.get(telegramChatId) || [];
      transactions.push({ ...payload, transactionId });
      transactionMap.set(telegramChatId, transactions);

      const outputText = `✅ Updated DS-${deviceNo} Sim${simNo} ${walletType.toUpperCase()}\n`;

      const formattedOutput = formatDeviceData(chat);

      return ctx.reply(outputText + formattedOutput, {
        reply_parameters: { message_id: ctx.message?.message_id! },
      });
    } catch (error) {
      console.error("Error updating balance:", error);
      if (error instanceof Error && error.cause === "NOT_FOUND") {
        return ctx.reply("❌ No wallets found for this chat.", {
          reply_parameters: { message_id: ctx.message?.message_id! },
        });
      }
      return ctx.reply(`❌ Failed to update balance`, {
        reply_parameters: { message_id: ctx.message?.message_id! },
      });
    }
  });

  //   const text = `DS-1

  // Sim1 - 01832553404 BK 80K | NG 1K
  // Sim2 - 01832553404 BK 80K | NG 1K
  // Sim3 - 01832553404 BK 80K | NG 1K
  // `.trim();
  //   console.log(parseDeviceSet(text));

  //   const messsage = "-30000 ds-14 sim4 ng";
  //   const regex = /^([+-]\d+)\s+ds-(\d+)\s+sim([1-4])\s+(bk|ng)$/i;
  //   const match = messsage.match(regex);
  //   if (match) {
  //     const amount = Number(match[1]);
  //     const deviceNo = match[2];
  //     const simNo = match[3];
  //     const walletType = match[4]?.toLowerCase();
  //     console.log("Amount:", amount);
  //     console.log("Device No:", deviceNo);
  //     console.log("Sim No:", simNo);
  //     console.log("Wallet Type:", walletType);
  //   } else {
  //     console.log("No match found.");
  //   }
}
