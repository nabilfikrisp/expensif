import type { OpenAPIHono } from "@hono/zod-openapi";
import { sql } from "drizzle-orm";

import { initApiKeyRoutes } from "@/modules/api-key/controllers/http";
import { generateApiKeyRespSchema } from "@/modules/api-key/controllers/http/generate";
import { initApiKeyService } from "@/modules/api-key/service";
import { initAuthRoutes } from "@/modules/auth/controllers/http";
import { initAuthMiddleware } from "@/modules/auth/controllers/middleware";
import { initAuthService } from "@/modules/auth/service";
import { initLinkedAccountRoutes } from "@/modules/linked-account/controllers/http";
import { listLinkedAccountsRespSchema } from "@/modules/linked-account/controllers/http/list";
import { initLinkedAccountService } from "@/modules/linked-account/service";
import { initLinkedAccountUseCase } from "@/modules/linked-account/use-case";
import { initUserRoutes } from "@/modules/user/controllers/http";
import { initUserService } from "@/modules/user/service";
import { initDb } from "@/pkg/db";
import type { Db, DbClient } from "@/pkg/db";
import { apiKeys, categories, expenses, linkedAccounts, messages, users } from "@/pkg/db/schema";
import type { EnvSchema } from "@/pkg/env";
import { API_PREFIX, initHttp } from "@/pkg/http";
import { initLogger } from "@/pkg/logger";
import { initRateLimiters } from "@/shared/rate-limit";

const TEST_DATABASE_URL =
  "postgres://expensif_test:local_test_password@127.0.0.1:5433/expensif_test";

async function assertTestDatabase(client: DbClient) {
  const url = new URL(TEST_DATABASE_URL);
  if (
    url.protocol !== "postgres:" ||
    url.hostname !== "127.0.0.1" ||
    url.port !== "5433" ||
    url.pathname !== "/expensif_test" ||
    url.username !== "expensif_test" ||
    url.search !== ""
  ) {
    throw new Error("Refusing to use an unexpected test database URL");
  }

  const result = await client.query<{ database: string; role: string }>(
    "SELECT current_database() AS database, current_user AS role"
  );
  const identity = result.rows.at(0);
  if (identity?.database !== "expensif_test" || identity.role !== "expensif_test") {
    throw new Error("Refusing to use a database or role other than expensif_test");
  }
}

export async function initTestDb() {
  const database = initDb(TEST_DATABASE_URL, { connectionTimeoutMillis: 5000 });
  const { client } = database;

  try {
    await client.query("SELECT 1");
  } catch (error) {
    await client.end();
    throw new Error(
      [
        "Cannot connect to the configured PostgreSQL test database.",
        "Stop the development database and start the test database from the repository root:",
        "  docker compose -f docker/compose.yml down",
        "  docker compose -f docker/compose.test.yml up -d --wait",
      ].join("\n"),
      { cause: error }
    );
  }

  try {
    await assertTestDatabase(client);
    return {
      ...database,
      resetDb: async () => {
        await database.db.execute(
          sql`TRUNCATE TABLE ${users}, ${categories}, ${messages}, ${expenses}, ${linkedAccounts}, ${apiKeys}`
        );
      },
    };
  } catch (error) {
    await client.end();
    throw error;
  }
}

function buildEnv(): EnvSchema {
  return {
    NODE_ENV: "test",
    DATABASE_URL: TEST_DATABASE_URL,
    PORT: 0,
    DEPLOY_PROXY: "none",
    JWT_SECRET: "test-secret-must-be-at-least-32-characters",
    ACCESS_TOKEN_EXPIRES_IN_MINUTES: "15m",
    REFRESH_TOKEN_EXPIRES_IN_DAYS: "7d",
    TELEGRAM_BOT_TOKEN: "dummy",
    OPENROUTER_API_KEY: "dummy",
    OPENROUTER_MODEL: "dummy",
    API_KEY_SECRET: "dummy",
    API_KEY_REDEEM_WINDOW_MINUTES: 15,
  };
}

function buildApp(env: EnvSchema, db: Db) {
  const logger = initLogger(env);

  // services
  const authService = initAuthService(env, db);
  const apiKeyService = initApiKeyService(env, db);
  const linkedAccountService = initLinkedAccountService(db);
  const userService = initUserService(db);

  // use cases
  const linkedAccountUseCase = initLinkedAccountUseCase({
    db,
    apiKeyService,
    linkedAccountService,
    userService,
  });

  // http
  const accessSecret = authService.encodeSecret(env.JWT_SECRET);
  const authMiddleware = initAuthMiddleware((t) => authService.verifyToken(t, accessSecret));
  const rateLimiters = initRateLimiters(env.DEPLOY_PROXY, {
    default: { limit: 1000, windowMs: 60_000 },
    login: { limit: 1000, windowMs: 60_000 },
    register: { limit: 1000, windowMs: 60_000 },
  });
  const authRoutes = initAuthRoutes({
    env,
    authService,
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
      {
        prefix: "linked-account",
        app: initLinkedAccountRoutes(linkedAccountService, authMiddleware),
      },
      { prefix: "api-key", app: initApiKeyRoutes(apiKeyService, authMiddleware) },
    ],
    {
      defaultLimiter: rateLimiters.default,
    }
  );

  return {
    app,
    services: {
      auth: authService,
      apiKey: apiKeyService,
      linkedAccount: linkedAccountService,
      user: userService,
    },
    useCases: {
      linkedAccount: linkedAccountUseCase,
    },
  };
}

export async function initTest() {
  const database = await initTestDb();
  try {
    const env = buildEnv();
    const app = buildApp(env, database.db);
    return { ...database, env, ...app };
  } catch (error) {
    try {
      await database.client.end();
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], "Test setup and pool cleanup failed");
    }
    throw error;
  }
}

export async function registerAndGetToken(
  app: OpenAPIHono,
  user: { email: string; password: string; name: string }
) {
  const res = await app.request(`${API_PREFIX}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  });

  const body = (await res.json()) as { data: { accessToken: string } };
  const accessToken = body.data.accessToken;

  const cookies = res.headers.getSetCookie();
  const refreshCookie = cookies.find((c) => c.startsWith("refresh_token="));
  if (!refreshCookie) {
    throw new Error("Refresh cookie not found");
  }
  const refreshToken = refreshCookie.split(";")[0].replace(/^refresh_token=/, "");

  const csrfCookie = cookies.find((c) => c.startsWith("csrf_token="));
  if (!csrfCookie) {
    throw new Error("CSRF cookie not found");
  }
  const csrfToken = csrfCookie.split(";")[0].replace(/^csrf_token=/, "");

  return { accessToken, refreshToken, csrfToken };
}

export async function createLinkedUser(ctx: Awaited<ReturnType<typeof initTest>>, name: string) {
  const { accessToken } = await registerAndGetToken(ctx.app, {
    email: `${name}@example.com`,
    password: "pass123",
    name,
  });
  const headers = { Authorization: `Bearer ${accessToken}` };
  const issued = await ctx.app.request(`${API_PREFIX}/api-key`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ label: "telegram" }),
  });
  if (issued.status !== 201) {
    throw new Error(`Key creation failed: ${issued.status}`);
  }
  const {
    data: { key },
  } = generateApiKeyRespSchema.parse(await issued.json());
  // Linking is a bot operation; seed through its use case, then exercise HTTP ownership.
  await ctx.useCases.linkedAccount.redeemApiKey({
    token: key,
    platform: "telegram",
    platformUserId: name,
  });
  const res = await ctx.app.request(`${API_PREFIX}/linked-account`, { headers });
  if (res.status !== 200) {
    throw new Error(`Linked-account listing failed: ${res.status}`);
  }
  const { data } = listLinkedAccountsRespSchema.parse(await res.json());
  if (data.length !== 1) {
    throw new Error("Expected one linked account");
  }
  return { headers, account: data[0] };
}
