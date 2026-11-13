import { initApiKeyRoutes } from "@/modules/api-key/controllers/http";
import { initApiKeyService } from "@/modules/api-key/service";
import { initAuthRoutes } from "@/modules/auth/controllers/http";
import { initAuthMiddleware } from "@/modules/auth/controllers/middleware";
import { initAuthService } from "@/modules/auth/service";
import { initAuthUseCase } from "@/modules/auth/use-case";
import { initCategoryService } from "@/modules/category/service";
import { registerExpenseCommands } from "@/modules/expense/controllers/bot";
import { initExpenseService } from "@/modules/expense/service";
import { initExpenseUseCase } from "@/modules/expense/use-case";
import { registerLinkCommand } from "@/modules/linked-account/controllers/bot";
import { initLinkedAccountRoutes } from "@/modules/linked-account/controllers/http";
import { initLinkedAccountService } from "@/modules/linked-account/service";
import { initLinkedAccountUseCase } from "@/modules/linked-account/use-case";
import type { LinkedAccountUseCase } from "@/modules/linked-account/use-case/interface";
import { initMessageService } from "@/modules/message/service";
import { initSessionService } from "@/modules/session/service";
import { initUserRoutes } from "@/modules/user/controllers/http";
import { initUserService } from "@/modules/user/service";
import { initBot } from "@/pkg/bot/telegram";
import type { Db } from "@/pkg/db";
import type { EnvSchema } from "@/pkg/env";
import { initHttp } from "@/pkg/http";
import type { Llm } from "@/pkg/llm";
import type { Logger } from "@/pkg/logger";
import { initRateLimiters } from "@/shared/rate-limit";
import type { RateLimitOverrides } from "@/shared/rate-limit";

interface InitAppParams {
  env: EnvSchema;
  db: Db;
  logger: Logger;
  rateLimitOverrides?: RateLimitOverrides;
}

export async function initApp({ env, db, logger, rateLimitOverrides }: InitAppParams) {
  const categoryService = initCategoryService({ db });
  await categoryService.seedCategories();

  const authService = initAuthService({ env, db });
  const sessionService = initSessionService({ env, db });
  const authUseCase = initAuthUseCase({ db, authService, sessionService });
  const apiKeyService = initApiKeyService({ env, db });
  const linkedAccountService = initLinkedAccountService({ db });
  const userService = initUserService({ db });

  const linkedAccountUseCase = initLinkedAccountUseCase({
    db,
    apiKeyService,
    linkedAccountService,
    userService,
  });

  const accessSecret = authService.encodeSecret(env.JWT_SECRET);
  const authMiddleware = initAuthMiddleware((t) => authService.verifyToken(t, accessSecret));
  const rateLimiters = initRateLimiters(env.DEPLOY_PROXY, rateLimitOverrides);
  const authRoutes = initAuthRoutes({
    env,
    authUseCase,
    userService,
    authMiddleware,
    rateLimiters,
  });

  const app = initHttp(
    env,
    logger,
    [
      { prefix: "auth", app: authRoutes },
      { prefix: "user", app: initUserRoutes(userService, authMiddleware) },
      { prefix: "api-key", app: initApiKeyRoutes(apiKeyService, authMiddleware) },
      {
        prefix: "linked-account",
        app: initLinkedAccountRoutes(linkedAccountService, authMiddleware),
      },
    ],
    { defaultLimiter: rateLimiters.default }
  );

  return {
    app,
    services: {
      auth: authService,
      session: sessionService,
      apiKey: apiKeyService,
      linkedAccount: linkedAccountService,
      user: userService,
    },
    useCases: {
      auth: authUseCase,
      linkedAccount: linkedAccountUseCase,
    },
  };
}

interface InitBotAppParams {
  env: EnvSchema;
  db: Db;
  logger: Logger;
  llm: Llm;
  linkedAccountUseCase: LinkedAccountUseCase;
}

export function initBotApp({ env, db, logger, llm, linkedAccountUseCase }: InitBotAppParams) {
  const categoryService = initCategoryService({ db });
  const expenseService = initExpenseService({ llm, db, categoryService });
  const linkedAccountService = initLinkedAccountService({ db });
  const expenseUseCase = initExpenseUseCase({
    db,
    expenseService,
    linkedAccountService,
    messageService: initMessageService({ db }),
  });
  const bot = initBot({ logger, token: env.TELEGRAM_BOT_TOKEN });
  registerExpenseCommands({ bot, logger, expenseUseCase });
  registerLinkCommand({ bot, logger, linkedAccountUseCase });
  bot.command("start", (ctx) => ctx.reply("Welcome! Up and running."));
  bot.on("message", (ctx) => ctx.reply("Got another message!"));
  return bot;
}
