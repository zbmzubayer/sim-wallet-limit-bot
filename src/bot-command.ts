import { Bot } from "grammy";
import { parseDeviceSet } from "./utils/parseDeviceSet";
import {
  createBotUser,
  deleteBotUserByUsername,
  getBotUserByUsername,
} from "./services/bot-user.service";
import { isAuthorized, isOwner } from "./services/auth.service";
import { createChatWithDeviceSims } from "./services/chat.service";

export function botCommand(bot: Bot) {
  // Set command
  bot.command("set", async (ctx) => {
    // Only owner and authorized users can set
    if (!isOwner(ctx.from?.id.toString() || "") && !isAuthorized(ctx.from?.username || "")) return;

    const deviceData = parseDeviceSet(ctx.match.trim());
    if (deviceData) {
      const telegramChatId = ctx.chat.id.toString();

      await createChatWithDeviceSims({
        telegramChatId,
        title: ctx.chat.title || "",
        deviceNo: deviceData.deviceNo,
        sims: deviceData.sims,
      });
      return ctx.reply("✅ Wallets have been set for this chat.", {
        reply_parameters: { message_id: ctx.message?.message_id! },
      });
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
  bot.command("reset", (ctx) => {
    // Only owner and authorized users can set
    if (!isOwner(ctx.from?.id.toString() || "") && !isAuthorized(ctx.from?.username || "")) return;

    const telegramChatId = ctx.chat.id.toString();
  });

  // Status command
  bot.command("status", async (ctx) => {
    // Only owner and authorized users can set
    if (!isOwner(ctx.from?.id.toString() || "") && !isAuthorized(ctx.from?.username || "")) return;

    ctx.reply("\uedc6\n" + "I'm online and ready to assist you, hello!", {
      reply_parameters: { message_id: ctx.message?.message_id! },
    });
    console.log("message:", ctx.message);
    console.log("chat:", ctx.chat);
    console.log("user:", ctx.from);
  });

  // AddUser command
  bot.command("addUser", async (ctx) => {
    // Only owner can add user
    if (!isOwner(ctx.from?.id.toString() || "")) return;

    const username = ctx.match.trim();
    if (!username) return ctx.reply("❌ Please provide a valid username.");
    const isUserExist = await getBotUserByUsername(username);
    if (isUserExist) {
      return ctx.reply("✅ User already exists.");
    } else {
      await createBotUser(username); // create the user in DB
      return ctx.reply(`✅ User ${username} has been added successfully.`);
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
      return ctx.reply("❌ User does not exist.");
    } else {
      await deleteBotUserByUsername(username); // Delete user in DB
      return ctx.reply(`\uf235\nUser ${username} has been removed successfully.`);
    }
  });

  bot.on("message:text", (ctx) => {
    ctx.reply("Hello! I'm your bot. from message");
    console.log(ctx.message.text);
  });

  const text = `DS-1

Sim1 - 01832553404 BK 80K | NG 1K
Sim2 - 01832553404 BK 80K | NG 1K
Sim3 - 01832553404 BK 80K | NG 1K
`.trim();
  console.log(parseDeviceSet(text));
}
