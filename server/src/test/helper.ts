import type { OpenAPIHono } from "@hono/zod-openapi";

import { MockLanguageModelV4 } from "ai/test";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Update } from "grammy/types";
import { Pool } from "pg";
import { expect, it } from "vitest";

import { initApp, initBotApp } from "@/app";
import { generateApiKeyRespSchema } from "@/modules/api-key/controllers/http/generate";
import { AuthError } from "@/modules/auth/error";
import { listLinkedAccountsRespSchema } from "@/modules/linked-account/controllers/http/list";
import { initDb } from "@/pkg/db";
import type { DbClient } from "@/pkg/db";
import { relations } from "@/pkg/db/relations";
import {
  apiKeys,
  categories,
  expenses,
  linkedAccounts,
  messages,
  sessions,
  users,
} from "@/pkg/db/schema";
import type { EnvSchema } from "@/pkg/env";
import { API_PREFIX } from "@/pkg/http";
import type { Logger } from "@/pkg/logger";
import { initLogger } from "@/pkg/logger";

export const mockUser = { email: "test@example.com", password: "pass1234", name: "Test User" };

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
          sql`TRUNCATE TABLE ${users}, ${categories}, ${messages}, ${expenses}, ${linkedAccounts}, ${apiKeys}, ${sessions}`
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
    API_ORIGIN: "http://localhost:3000",
    FRONTEND_ORIGIN: "http://localhost:5173",
    JWT_SECRET: "test-secret-must-be-at-least-32-characters",
    ACCESS_TOKEN_EXPIRES_IN_MINUTES: "15m",
    SESSION_IDLE_SECONDS: 7200,
    SESSION_ABSOLUTE_SECONDS: 86400,
    TELEGRAM_BOT_TOKEN: "dummy",
    OPENROUTER_API_KEY: "dummy",
    OPENROUTER_MODEL: "dummy",
    API_KEY_SECRET: "dummy",
    API_KEY_REDEEM_WINDOW_MINUTES: 15,
  };
}

export async function initTest() {
  const database = await initTestDb();
  try {
    const env = buildEnv();
    const app = initApp({
      env,
      db: database.db,
      logger: initLogger(env),
      rateLimitOverrides: {
        default: { limit: 1000, windowMs: 60_000 },
        login: { limit: 1000, windowMs: 60_000 },
        register: { limit: 1000, windowMs: 60_000 },
        changePassword: { limit: 1000, windowMs: 60_000 },
        logoutAll: { limit: 1000, windowMs: 60_000 },
      },
    });
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

export async function createApiKey(app: OpenAPIHono, accessToken: string, label?: string) {
  const response = await app.request(`${API_PREFIX}/api-key`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ label }),
  });
  if (response.status !== 201) {
    throw new Error(`Key creation failed: ${response.status}`);
  }
  return generateApiKeyRespSchema.parse(await response.json()).data;
}

export async function createLinkedUser(ctx: Awaited<ReturnType<typeof initTest>>, name: string) {
  const { accessToken } = await registerAndGetToken(ctx.app, {
    email: `${name}@example.com`,
    password: mockUser.password,
    name,
  });
  const headers = { Authorization: `Bearer ${accessToken}` };
  const { key } = await createApiKey(ctx.app, accessToken, "telegram");
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

export function sessionHeaders(tokens: { refreshToken: string; csrfToken: string }) {
  return {
    Cookie: `refresh_token=${tokens.refreshToken}; csrf_token=${tokens.csrfToken}`,
    "X-CSRF-Token": tokens.csrfToken,
  };
}

export function sessionCookies(response: Response) {
  function value(name: string) {
    const cookie = response.headers.getSetCookie().find((item) => item.startsWith(`${name}=`));
    if (!cookie || cookie.includes("Max-Age=0")) {
      throw new Error(`Expected live ${name} cookie`);
    }
    return cookie.split(";")[0].slice(name.length + 1);
  }
  return { refreshToken: value("refresh_token"), csrfToken: value("csrf_token") };
}

// A real PostgreSQL lock timeout exercises HTTP error handling and transaction rollback.
export async function withSessionWritesBlocked(
  ctx: Awaited<ReturnType<typeof initTest>>,
  run: (app: OpenAPIHono) => Promise<void>
) {
  const client = new Pool({
    connectionString: TEST_DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 5000,
    options: "-c lock_timeout=100ms",
  });
  try {
    await assertTestDatabase(client);
    const { app } = initApp({
      env: ctx.env,
      db: drizzle({ client, relations }),
      logger: initLogger(ctx.env),
    });
    await ctx.db.transaction(async (tx) => {
      await tx.execute(sql`LOCK TABLE ${sessions} IN SHARE MODE`);
      await run(app);
    });
  } finally {
    await client.end();
  }
}

export async function loginAndGetTokens(app: OpenAPIHono, email: string, password: string) {
  const response = await app.request(`${API_PREFIX}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (response.status !== 200) {
    throw new Error(`Login failed: ${response.status}`);
  }
  const body = (await response.json()) as { data: { accessToken: string } };
  return { accessToken: body.data.accessToken, ...sessionCookies(response) };
}

export function initTestBot(
  ctx: Awaited<ReturnType<typeof initTest>>,
  db = ctx.db,
  logger: Logger = initLogger(ctx.env)
) {
  const bot = initBotApp({
    env: ctx.env,
    db,
    logger,
    llm: { model: new MockLanguageModelV4() },
    linkedAccountUseCase: ctx.useCases.linkedAccount,
  });
  bot.botInfo = {
    id: 999,
    is_bot: true,
    first_name: "Bot",
    username: "test_bot",
    can_join_groups: true,
    can_read_all_group_messages: false,
    supports_inline_queries: false,
    can_connect_to_business: false,
    has_main_web_app: false,
    has_topics_enabled: false,
    allows_users_to_create_topics: false,
    can_manage_bots: false,
    supports_join_request_queries: false,
  };
  return bot;
}

export function botCommand(
  text: string,
  id = 123,
  chatType: "private" | "group" = "private",
  username?: string
): Update {
  const chat =
    chatType === "private"
      ? { id, type: "private" as const, first_name: "Test" }
      : { id: -100, type: "group" as const, title: "Test" };
  return {
    update_id: id,
    message: {
      message_id: id,
      date: 0,
      chat,
      from: { id, is_bot: false, first_name: "Test", username },
      text,
      entities: [{ type: "bot_command", offset: 0, length: text.split(" ")[0].length }],
    },
  };
}

export function testBearerAuthentication(getApp: () => OpenAPIHono, method: string, path: string) {
  it.each([
    [undefined, AuthError.missingBearerHeader()],
    ["Bearer invalid-token-value", AuthError.failedVerifyingJwt()],
  ] as const)("rejects unauthorized access (%s)", async (authorization, error) => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (authorization) {
      headers.Authorization = authorization;
    }
    const response = await getApp().request(`${API_PREFIX}${path}`, {
      method,
      headers,
      ...(method === "POST" ? { body: "{}" } : {}),
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      success: false,
      error: error.code,
      message: error.message,
    });
  });
}

export function refreshSession(
  app: OpenAPIHono,
  tokens: { refreshToken: string; csrfToken: string }
) {
  return app.request(`${API_PREFIX}/auth/refresh`, {
    method: "POST",
    headers: sessionHeaders(tokens),
  });
}
