import type { OpenAPIHono } from "@hono/zod-openapi";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { TestContext } from "./app";
import { assertTestDatabase, TEST_DATABASE_URL } from "./database";
import { initApp } from "@/app";
import { relations } from "@/pkg/db/relations";
import { sessions } from "@/pkg/db/schema";
import { initLogger } from "@/pkg/logger";

// A real PostgreSQL lock timeout exercises HTTP error handling and transaction rollback.
export async function withSessionWritesBlocked(
  context: TestContext,
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
    const { app } = await initApp({
      env: context.env,
      db: drizzle({ client, relations }),
      logger: initLogger(context.env),
    });
    await context.db.transaction(async (tx) => {
      await tx.execute(sql`LOCK TABLE ${sessions} IN SHARE MODE`);
      await run(app);
    });
  } finally {
    await client.end();
  }
}
