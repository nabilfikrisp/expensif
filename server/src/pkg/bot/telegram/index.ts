import { Bot } from "grammy";
import { registerExpenseCommands } from "@/modules/expense/controllers/bot";
import type { ExpensesService } from "@/modules/expense/service";
import { registerLinkCommand } from "@/modules/linked-account/controllers/bot";
import type { LinkedAccountUseCase } from "@/modules/linked-account/use-case";
import type { Logger } from "@/pkg/logger";

export interface InitBotParams {
  token: string;
  logger: Logger;
  expenseService: ExpensesService;
  linkedAccountUseCase: LinkedAccountUseCase;
}

export function initBot({ token, logger, expenseService, linkedAccountUseCase }: InitBotParams) {
  // orders matters for command and message
  const bot = new Bot(token);

  registerExpenseCommands(bot, logger, expenseService);
  registerLinkCommand(bot, logger, linkedAccountUseCase);
  bot.command("start", (ctx) => ctx.reply("Welcome! Up and running."));
  bot.on("message", (ctx) => ctx.reply("Got another message!"));

  return bot;
}

export function startBot(bot: Bot, logger: Logger) {
  void bot.start().catch((err: unknown) => {
    if (err instanceof Error && err.message !== "Aborted delay") {
      logger.error({ err }, "Bot stopped with error");
    }
  });
  logger.info("Telegram Bot is running...");
}
