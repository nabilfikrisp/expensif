import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import path from "node:path";

import { assertTestDatabase, TEST_DATABASE_URL } from "./helper";

const migrationsFolder = path.resolve(import.meta.dirname, "../pkg/db/migrations");

function isConnectionError(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current = error;

  while (current !== null && typeof current === "object" && !seen.has(current)) {
    seen.add(current);

    if (
      "code" in current &&
      (current.code === "ECONNREFUSED" ||
        current.code === "ECONNRESET" ||
        current.code === "ETIMEDOUT" ||
        current.code === "EHOSTUNREACH" ||
        current.code === "ENETUNREACH" ||
        current.code === "28P01" ||
        current.code === "28000" ||
        current.code === "3D000")
    ) {
      return true;
    }

    current = "cause" in current ? current.cause : undefined;
  }

  return false;
}

export default async function setup() {
  const pool = new Pool({
    connectionString: TEST_DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });

  try {
    await assertTestDatabase(pool);
    await migrate(drizzle({ client: pool }), { migrationsFolder });
  } catch (error) {
    if (isConnectionError(error)) {
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

    throw error;
  } finally {
    await pool.end();
  }
}
