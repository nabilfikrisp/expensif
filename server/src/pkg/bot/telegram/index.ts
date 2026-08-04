import { Bot } from "grammy";
import { registerExpenseCommands } from "@/modules/expense/controllers/bot";
import type { ExpensesService } from "@/modules/expense/service";
import type { Logger } from "@/pkg/logger";

export function initBot(token: string, logger: Logger, expenseService: ExpensesService) {
  // orders matters for command and message
  const bot = new Bot(token);

  registerExpenseCommands(bot, logger, expenseService);
  bot.command("start", (ctx) => ctx.reply("Welcome! Up and running."));
  bot.on("message", (ctx) => ctx.reply("Got another message!"));

  return bot;
}

export function startBot(bot: Bot, logger: Logger) {
  void bot.start();
  logger.info("Telegram Bot is running...");
}
