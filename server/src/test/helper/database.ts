import { sql } from "drizzle-orm";
import { initDb } from "@/pkg/db";
import type { DbClient } from "@/pkg/db";
import {
  apiKeys,
  categories,
  expenses,
  linkedAccounts,
  messages,
  sessions,
  users,
} from "@/pkg/db/schema";

import { initLogger } from "@/pkg/logger";

export const TEST_DATABASE_URL =
  "postgres://expensif_test:local_test_password@127.0.0.1:5434/expensif_test";

export async function initTestDb() {
  const database = initDb(TEST_DATABASE_URL, initLogger({ NODE_ENV: "test" }), {
    connectionTimeoutMillis: 5000,
  });
  const { client } = database;

  try {
    await client.query("SELECT 1");
  } catch (error) {
    await client.end();
    throw new Error(
      [
        "Cannot connect to the configured PostgreSQL test database.",
        "Run tests through pnpm test:run or pnpm test from server/ to manage the test database.",
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

export async function assertTestDatabase(client: DbClient) {
  const url = new URL(TEST_DATABASE_URL);
  if (
    url.protocol !== "postgres:" ||
    url.hostname !== "127.0.0.1" ||
    url.port !== "5434" ||
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
