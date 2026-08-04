/* eslint-disable n/no-process-exit */
import type { ServerType } from "@hono/node-server";
import type { Bot } from "grammy";
import type { DbClient } from "@/pkg/db";
import type { Logger } from "@/pkg/logger";

let isShuttingDown = false;

interface ShutdownOptions {
  logger: Logger;
  bot: Bot;
  httpServer: ServerType;
  dbClient: DbClient;
}

const SHUTDOWN_TIMEOUT = 10_000; // 10 seconds

export async function shutdown(signal: string, opts: ShutdownOptions) {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  const { logger, bot, httpServer, dbClient } = opts;

  logger.info(`Received ${signal}, shutting down gracefully...`);

  const forceExitTimeout = setTimeout(() => {
    logger.error("Shutdown timed out, forcing exit");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);
  forceExitTimeout.unref();

  try {
    await bot.stop();
    logger.info("Telegram bot stopped");

    await new Promise<void>((resolve, reject) => {
      httpServer.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
    logger.info("HTTP server closed");

    dbClient.close();
    logger.info("Database connection closed");

    logger.info("Shutdown complete");
    process.exit(0);
  } catch (err) {
    logger.error({ err }, "Error during shutdown");
    process.exit(1);
  }
}
