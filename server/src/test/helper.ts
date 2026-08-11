import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import fs from "fs";
import path from "path";

import { initAuthRoutes } from "@/modules/auth/controllers/http";
import { initAuthService } from "@/modules/auth/service";
import { relations } from "@/pkg/db/relations";
import type { EnvSchema } from "@/pkg/env";
import { initHttp } from "@/pkg/http";
import { initLogger } from "@/pkg/logger";

async function runMigrations(client: ReturnType<typeof createClient>) {
  const migrationsDir = path.resolve(import.meta.dirname, "../pkg/db/migrations");
  const folders = fs
    .readdirSync(migrationsDir)
    .filter((f) => fs.statSync(path.join(migrationsDir, f)).isDirectory())
    .sort();

  for (const folder of folders) {
    const file = path.join(migrationsDir, folder, "migration.sql");
    if (!fs.existsSync(file)) {
      continue;
    }

    const sql = fs.readFileSync(file, "utf-8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const stmt of statements) {
      await client.execute(stmt);
    }
  }
}

export async function initTest() {
  const client = createClient({ url: ":memory:" });

  await runMigrations(client);

  const db = drizzle({ client, relations });
  const env: EnvSchema = {
    NODE_ENV: "test",
    DATABASE_URL: ":memory:",
    PORT: 0,
    JWT_SECRET: "test-secret-must-be-at-least-32-characters",
    ACCESS_TOKEN_EXPIRES_IN_MINUTES: "15m",
    REFRESH_TOKEN_EXPIRES_IN_DAYS: "7d",
    TELEGRAM_BOT_TOKEN: "dummy",
    OPENROUTER_API_KEY: "dummy",
    OPENROUTER_MODEL: "dummy",
  };

  const logger = initLogger(env);
  const authService = initAuthService(env, db);
  const authRoutes = initAuthRoutes(env, authService);
  const app = initHttp(env, logger, [{ prefix: "auth", app: authRoutes }]);

  return { app, db, client, env, authService };
}
