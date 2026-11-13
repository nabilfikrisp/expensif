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
  bot.on(["message", "channel_post"], async (ctx, next) => {
    logger.info(
      {
        updateId: ctx.update.update_id,
        messageId: ctx.msg.message_id,
        chatId: ctx.chat.id,
      },
      "Telegram message received"
    );
    if (ctx.chat.type !== "private") {
      await ctx.reply("Please use this bot in a private chat.");
      return;
    }
    await next();
  });

  return bot;
}

/**
 * Starts polling and returns a lifetime promise, not a readiness promise.
 * Awaiting it blocks subsequent code until polling and handlers finish; use onStart
 * for readiness. This server retains the promise so HTTP and signal setup can proceed,
 * then awaits it during shutdown after requesting bot.stop(). Terminal failures are
 * handled below, even when the caller does not await the promise immediately.
 */
export function startBot(bot: Bot, logger: Logger): Promise<void> {
  const lifecycle = bot
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

  return lifecycle;
}
