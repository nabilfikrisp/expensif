/* eslint-disable n/no-process-exit */
import type { ServerType } from "@hono/node-server";
import type { Bot } from "grammy";
import type { DbClient } from "@/pkg/db";
import type { Logger } from "@/pkg/logger";

let isShuttingDown = false;

interface ShutdownOptions {
  logger: Logger;
  apiLogger: Logger;
  botLogger: Logger;
  schedulerLogger: Logger;
  bot: Bot;
  botLifecycle: Promise<void>;
  httpServer: ServerType;
  dbClient: DbClient;
  stopJobs: () => Promise<void>;
}

const SHUTDOWN_TIMEOUT_SECONDS = 10_000;

export async function shutdown(signal: string, opts: ShutdownOptions) {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  const {
    logger,
    apiLogger,
    botLogger,
    schedulerLogger,
    bot,
    botLifecycle,
    httpServer,
    dbClient,
    stopJobs,
  } = opts;

  logger.info(`Received ${signal}, shutting down gracefully...`);

  setTimeout(() => {
    logger.error("Shutdown timed out, forcing exit");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_SECONDS);

  async function stopBot() {
    await bot.stop();
    // stop() acknowledges updates but does not wait for their handlers.
    await botLifecycle;
    botLogger.info("Telegram bot stopped");
  }

  async function stopScheduledJobs() {
    await stopJobs();
    schedulerLogger.info("Scheduled jobs stopped");
  }

  async function closeHttp() {
    await new Promise<void>((resolve, reject) => {
      httpServer.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
    apiLogger.info("HTTP server closed");
  }

  try {
    // Stop all intake immediately, then drain every database consumer before closing the pool.
    const botStopped = stopBot();
    const jobsStopped = stopScheduledJobs();
    const httpClosed = closeHttp();

    await Promise.all([botStopped, jobsStopped, httpClosed]);

    await dbClient.end();
    logger.info("Database connection closed");

    logger.info("Shutdown complete");
    process.exit(0);
  } catch (err) {
    logger.error({ err }, "Error during shutdown");
    process.exit(1);
  }
}
