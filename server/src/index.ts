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
const { db, client } = initDb(env.DATABASE_URL);
const logger = initLogger(env);
const llm = initLlm(env.OPENROUTER_API_KEY, env.OPENROUTER_MODEL);
const { app, useCases, services } = await initApp({ env, db, logger });
const bot = initBotApp({ env, db, logger, llm, linkedAccountUseCase: useCases.linkedAccount });
const sessionCleanup = initScheduledJob({
  name: "session-cleanup",
  intervalMs: 24 * 60 * 60 * 1000,
  run: () => services.session.cleanupExpiredSessions(),
  logger,
});

await sessionCleanup.start();
const httpServer = startHttp(app, logger, env.PORT);
startBot(bot, logger);

process.on(
  "SIGTERM",
  () =>
    void shutdown("SIGTERM", {
      logger,
      bot,
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
      bot,
      httpServer,
      dbClient: client,
      stopJobs: () => sessionCleanup.stop(),
    })
);
