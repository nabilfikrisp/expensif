import { initApiKeyRoutes } from "@/modules/api-key/controllers/http";
import { initApiKeyService } from "@/modules/api-key/service";
import { initAuthRoutes } from "@/modules/auth/controllers/http";
import { initAuthMiddleware } from "@/modules/auth/controllers/middleware";
import { initAuthService } from "@/modules/auth/service";
import { initExpenseService } from "@/modules/expense/service";
import { initLinkedAccountService } from "@/modules/linked-account/service";
import { initBot, startBot } from "@/pkg/bot/telegram";
import { initDb } from "@/pkg/db";
import { initEnv } from "@/pkg/env";
import { initHttp, startHttp } from "@/pkg/http";
import { initLlm } from "@/pkg/llm";
import { initLogger } from "@/pkg/logger";
import { initRateLimiters } from "@/shared/rate-limit";
import { shutdown } from "@/shutdown";

const env = initEnv();
const { db, client } = initDb(env.DATABASE_URL);
const logger = initLogger(env);
const llm = initLlm(env.OPENROUTER_API_KEY, env.OPENROUTER_MODEL);
const expenseService = initExpenseService(llm, db);
const authService = initAuthService(env, db);

const accessSecret = authService.encodeSecret(env.JWT_SECRET);
const authMiddleware = initAuthMiddleware((t) => authService.verifyToken(t, accessSecret));

const rateLimiters = initRateLimiters(env.DEPLOY_PROXY);

const authRoutes = initAuthRoutes(env, authService, authMiddleware, rateLimiters);

const linkedAccountService = initLinkedAccountService(db);
const apiKeyService = initApiKeyService(env, db);
const apiKeyRoutes = initApiKeyRoutes(apiKeyService, authMiddleware);

const app = initHttp(
  env,
  logger,
  [
    { prefix: "auth", app: authRoutes },
    { prefix: "api-key", app: apiKeyRoutes },
  ],
  { defaultLimiter: rateLimiters.default }
);
const bot = initBot(env.TELEGRAM_BOT_TOKEN, logger, expenseService);

const httpServer = startHttp(app, logger, env.PORT);
startBot(bot, logger);

process.on(
  "SIGTERM",
  () => void shutdown("SIGTERM", { logger, bot, httpServer, dbClient: client })
);
process.on("SIGINT", () => void shutdown("SIGINT", { logger, bot, httpServer, dbClient: client }));
