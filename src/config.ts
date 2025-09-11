import "dotenv/config";

export const ENV = {
  BOT_TOKEN: process.env.BOT_TOKEN || "",
  BOT_OWNER_ID: process.env.BOT_OWNER_ID || "",
};
