import { Bot } from "grammy";

export function initBot(token: string) {
  const bot = new Bot(token);

  bot.command("start", (ctx) => ctx.reply("Welcome! Up and running."));

  bot.on("message", (ctx) => ctx.reply("Got another message!"));

  return bot;
}

export function startBot(bot: Bot) {
  void bot.start();
  console.log("Telegram Bot is running...");
}
