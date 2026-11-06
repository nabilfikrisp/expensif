import { Bot } from "grammy";
import type { Logger } from "@/pkg/logger";

export interface InitBotParams {
  token: string;
  logger: Logger;
}

export function initBot({ token, logger }: InitBotParams) {
  const bot = new Bot(token);
  bot.catch((err) => {
    logger.error({ err: err.error, updateId: err.ctx.update.update_id }, "Bot update failed");
  });

  return bot;
}

export function startBot(bot: Bot, logger: Logger) {
  void bot
    .start({
      onStart: () => {
        logger.info("Telegram Bot is running...");
      },
    })
    .catch((err: unknown) => {
      // grammY aborts retry delays when bot.stop() cancels polling during shutdown.
      if (err instanceof Error && err.message === "Aborted delay") {
        return;
      }
      logger.error({ err }, "Bot stopped with error");
      // eslint-disable-next-line n/no-process-exit -- HTTP must not outlive a failed bot.
      process.exit(1);
    });
}
