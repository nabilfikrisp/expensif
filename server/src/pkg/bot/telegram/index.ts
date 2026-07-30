import { Bot } from "grammy";
import { registerExpenseCommands } from "@/modules/expense/controllers/bot";
import type { ExpensesService } from "@/modules/expense/service";

export function initBot(token: string, expenseService: ExpensesService) {
  // orders matters for command and message
  const bot = new Bot(token);

  registerExpenseCommands(bot, expenseService);
  bot.command("start", (ctx) => ctx.reply("Welcome! Up and running."));
  bot.on("message", (ctx) => ctx.reply("Got another message!"));

  return bot;
}

export function startBot(bot: Bot) {
  void bot.start();
  console.log("Telegram Bot is running...");
}
