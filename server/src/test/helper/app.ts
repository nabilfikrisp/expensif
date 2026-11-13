import { initTestDb, TEST_DATABASE_URL } from "./database";
import { initApp } from "@/app";
import type { EnvSchema } from "@/pkg/env";
import { initLogger } from "@/pkg/logger";

export type TestContext = Awaited<ReturnType<typeof initTest>>;

export async function initTest() {
  const database = await initTestDb();
  try {
    const env = createTestEnv();
    const application = await initApp({
      env,
      db: database.db,
      logger: initLogger(env),
      dbLogger: initLogger(env).child({ service: "runtime", component: "db" }),
      rateLimitOverrides: {
        default: { limit: 1000, windowMs: 60_000 },
        login: { limit: 1000, windowMs: 60_000 },
        register: { limit: 1000, windowMs: 60_000 },
        changePassword: { limit: 1000, windowMs: 60_000 },
        logoutAll: { limit: 1000, windowMs: 60_000 },
      },
    });
    return { ...database, env, ...application };
  } catch (error) {
    try {
      await database.client.end();
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], "Test setup and pool cleanup failed");
    }
    throw error;
  }
}

function createTestEnv(): EnvSchema {
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
