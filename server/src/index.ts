import { initApp, initBotApp } from "@/app";
import { startBot } from "@/pkg/bot/telegram";
import { initDb } from "@/pkg/db";
import { initEnv } from "@/pkg/env";
import { startHttp } from "@/pkg/http";
import { initLlm } from "@/pkg/llm";
import { initLogger } from "@/pkg/logger";
import { initScheduledJob } from "@/pkg/scheduler";
import { shutdown } from "@/shutdown";

const env = initEnv();
const rootLogger = initLogger(env);
const logger = rootLogger.child({ service: "runtime" });
const dbLogger = logger.child({ component: "db" });
const apiLogger = rootLogger.child({ service: "api" });
const botLogger = rootLogger.child({ service: "bot" });
const schedulerLogger = rootLogger.child({ service: "scheduler" });
const { db, client } = initDb(env.DATABASE_URL, dbLogger);
const llm = initLlm(env.OPENROUTER_API_KEY, env.OPENROUTER_MODEL);
const { app, useCases, services } = await initApp({ env, db, logger: apiLogger, dbLogger });
const bot = initBotApp({
  env,
  db,
  logger: botLogger,
  llm,
  linkedAccountUseCase: useCases.linkedAccount,
});
const sessionCleanup = initScheduledJob({
  name: "session-cleanup",
  intervalMs: 24 * 60 * 60 * 1000,
  run: () => services.session.cleanupExpiredSessions(),
  logger: schedulerLogger,
});

await sessionCleanup.start();
const httpServer = startHttp(app, apiLogger, env.PORT);
const botLifecycle = startBot(bot, botLogger);

process.on(
  "SIGTERM",
  () =>
    void shutdown("SIGTERM", {
      logger,
      apiLogger,
      botLogger,
      schedulerLogger,
      bot,
      botLifecycle,
      httpServer,
      dbClient: client,
      stopJobs: () => sessionCleanup.stop(),
    })
);
process.on(
  "SIGINT",
  () =>
    void shutdown("SIGINT", {
      logger,
      apiLogger,
      botLogger,
      schedulerLogger,
      bot,
      botLifecycle,
      httpServer,
      dbClient: client,
      stopJobs: () => sessionCleanup.stop(),
    })
);
