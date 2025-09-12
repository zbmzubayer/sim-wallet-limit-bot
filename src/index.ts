import { Bot } from "grammy";

import { ENV } from "./config";
import { botCommand } from "./bot-command";
import { connectDB } from "./lib/db";
import { initAuthBotUserCache } from "./services/auth.service";

async function bootstrap() {
  await connectDB();
  await initAuthBotUserCache();

  const bot = new Bot(ENV.BOT_TOKEN);

  botCommand(bot);

  try {
    bot.start({ onStart: () => console.log("DSW Limit Bot started") });
  } catch (error) {
    console.error("Error starting bot:", error);
    process.once("SIGINT", () => bot.stop());
    process.once("SIGTERM", () => bot.stop());
  }
  process.once("SIGINT", () => bot.stop());
  process.once("SIGTERM", () => bot.stop());
}

bootstrap();
