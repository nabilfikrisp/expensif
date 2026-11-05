// pkg/db/index.ts (or wherever initDb lives)
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import { relations } from "./relations";

/**
 * libsql's local (file) client opens a fresh connection per transaction, and SQLite
 * allows one writer at a time. Overlapping write transactions therefore fail with
 * SQLITE_BUSY instead of waiting. Queue them in-process so they run one after another.
 *
 * Rule: inside a transaction callback always use `tx`, never `db`. Calling db.transaction()
 * from inside a transaction would wait for itself forever.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeTransactions<T extends { transaction: (...args: any[]) => Promise<any> }>(
  db: T
): T {
  const original = db.transaction.bind(db);
  let tail: Promise<unknown> = Promise.resolve();

  db.transaction = ((...args: unknown[]) => {
    const run = tail.then(() => original(...args));
    // A failed transaction must not block the ones queued behind it.
    tail = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }) as T["transaction"];

  return db;
}

export function initDb(databaseUrl: string) {
  const client = createClient({ url: databaseUrl });
  const db = serializeTransactions(drizzle({ client, relations }));
  return { db, client };
}

export type Db = ReturnType<typeof initDb>["db"];
export type DbClient = ReturnType<typeof initDb>["client"];
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbTx = Db | Tx;
