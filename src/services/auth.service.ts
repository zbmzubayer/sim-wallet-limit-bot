import { ENV } from "../config";
import { getAllBotUsers } from "./bot-user.service";

export const authBotUserCache = new Set<string>();

export const isAuthorized = (username: string): boolean => {
  return authBotUserCache.has(username);
};

export const initAuthBotUserCache = async () => {
  const users = await getAllBotUsers();
  users.forEach((user) => authBotUserCache.add(user.telegramUsername));
};

export const addAuthorizedBotUser = (username: string) => {
  authBotUserCache.add(username);
};

export const removeAuthorizedBotUser = (username: string) => {
  authBotUserCache.delete(username);
};

export const isOwner = (telegramId: string): boolean => {
  return telegramId === ENV.BOT_OWNER_ID;
};
