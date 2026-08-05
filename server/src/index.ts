import { initAuthRoutes } from "@/modules/auth/controllers/http";
import { initAuthService } from "@/modules/auth/service";
import { initExpenseService } from "@/modules/expense/service";
import { initBot, startBot } from "@/pkg/bot/telegram";
import { initDb } from "@/pkg/db";
import { initEnv } from "@/pkg/env";
import { initHttp, startHttp } from "@/pkg/http";
import { initLlm } from "@/pkg/llm";
import { initLogger } from "@/pkg/logger";
import { shutdown } from "@/shutdown";

const env = initEnv();
const { db, client } = initDb(env.DATABASE_URL);
const logger = initLogger(env);
const llm = initLlm(env.OPENROUTER_API_KEY, env.OPENROUTER_MODEL);
const expenseService = initExpenseService(llm, db);
const authService = initAuthService(env, db);
const authRoutes = initAuthRoutes(env, authService);

const app = initHttp(env, logger, [{ prefix: "auth", app: authRoutes }]);
const bot = initBot(env.TELEGRAM_BOT_TOKEN, logger, expenseService);

const httpServer = startHttp(app, logger, env.PORT);
startBot(bot, logger);

process.on(
  "SIGTERM",
  () => void shutdown("SIGTERM", { logger, bot, httpServer, dbClient: client })
);
process.on("SIGINT", () => void shutdown("SIGINT", { logger, bot, httpServer, dbClient: client }));
