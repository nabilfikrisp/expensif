import type { OpenAPIHono } from "@hono/zod-openapi";
import type { createClient } from "@libsql/client";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

import { initApiKeyService } from "@/modules/api-key/service";
import { initAuthRoutes } from "@/modules/auth/controllers/http";
import { initAuthMiddleware } from "@/modules/auth/controllers/middleware";
import { initAuthService } from "@/modules/auth/service";
import { initLinkedAccountService } from "@/modules/linked-account/service";
import { initLinkedAccountUseCase } from "@/modules/linked-account/use-case";
import { initUserService } from "@/modules/user/service";
import { initDb } from "@/pkg/db";
import type { Db } from "@/pkg/db";
import type { EnvSchema } from "@/pkg/env";
import { API_PREFIX, initHttp } from "@/pkg/http";
import { initLogger } from "@/pkg/logger";
import { initRateLimiters } from "@/shared/rate-limit";

async function runMigrations(client: ReturnType<typeof createClient>) {
  const migrationsDir = path.resolve(import.meta.dirname, "../pkg/db/migrations");
  const folders = fs
    .readdirSync(migrationsDir)
    .filter((f) => fs.statSync(path.join(migrationsDir, f)).isDirectory())
    .sort();

  const statements: string[] = [];
  for (const folder of folders) {
    const file = path.join(migrationsDir, folder, "migration.sql");
    if (!fs.existsSync(file)) {
      continue;
    }

    const sql = fs.readFileSync(file, "utf-8");
    statements.push(
      ...sql
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter(Boolean)
    );
  }

  await client.migrate(statements);
}

function buildEnv(databaseUrl: string): EnvSchema {
  return {
    NODE_ENV: "test",
    DATABASE_URL: databaseUrl,
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
  const app = initHttp(env, logger, [{ prefix: "auth", app: authRoutes }], {
    defaultLimiter: rateLimiters.default,
  });

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

async function setup(url: string) {
  const { db, client } = initDb(url);
  await runMigrations(client);
  const env = buildEnv(url);
  const appBuild = buildApp(env, db);
  return { db, client, env, ...appBuild };
}

/** General integration tests (HTTP etc.). Fast, in-memory. No transactions. */
export async function initTest() {
  return setup(":memory:");
}

/** Use case / service tests that rely on transactions. Real SQLite file via libsql. */
export async function initUseCaseTest() {
  // One folder per test: test/temp/<uuid>/test.db (gitignore test/temp/).
  const dir = path.join(import.meta.dirname, "temp", randomUUID());
  fs.mkdirSync(dir, { recursive: true });

  const ctx = await setup(`file:${path.join(dir, "test.db")}`);

  const cleanup = () => {
    ctx.client.close();
    fs.rmSync(dir, { recursive: true, force: true });
  };

  return { ...ctx, cleanup };
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
