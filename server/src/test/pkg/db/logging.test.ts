import { sql } from "drizzle-orm";
import { expect, it } from "vitest";

import { initDb } from "@/pkg/db";
import { initLogger } from "@/pkg/logger";
import { initTestDb, TEST_DATABASE_URL } from "@/test/helper/database";

// Idle pool failures happen outside service operations, so terminate a real idle
// PostgreSQL connection here rather than driving an HTTP or bot request.
it("logs an idle connection failure and replaces the client without duplicating query errors", async () => {
  const control = await initTestDb();
  const logs: string[] = [];
  const root = initLogger({ NODE_ENV: "production" }, { write: (line) => logs.push(line) });
  const database = initDb(TEST_DATABASE_URL, root.child({ service: "runtime", component: "db" }));
  try {
    const connection = await database.client.connect();
    const result = await connection.query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
    const pid = result.rows[0].pid;
    connection.release();

    await control.db.execute(sql`SELECT pg_terminate_backend(${pid})`);
    await expect.poll(() => logs.length).toBe(1);
    expect(JSON.parse(logs[0])).toMatchObject({
      level: 50,
      service: "runtime",
      component: "db",
      msg: "Idle database client failed",
      err: { code: "57P01" },
    });
    const replacement = await database.client.query<{ pid: number }>(
      "SELECT pg_backend_pid() AS pid"
    );
    expect(replacement.rows[0].pid).not.toBe(pid);

    await expect(database.db.execute(sql`SELECT 1 / 0`)).rejects.toMatchObject({
      cause: { code: "22012" },
    });
    expect(logs).toHaveLength(1);
    expect(logs.join("")).not.toContain(TEST_DATABASE_URL);
  } finally {
    await Promise.all([database.client.end(), control.client.end()]);
  }
});
