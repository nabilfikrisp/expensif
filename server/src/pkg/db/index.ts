import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { PoolConfig } from "pg";

import { relations } from "./relations";

export function initDb(
  databaseUrl: string,
  options: Pick<PoolConfig, "connectionTimeoutMillis"> = {}
) {
  const client = new Pool({
    connectionString: databaseUrl,
    max: 10,
    connectionTimeoutMillis: 5_000,
    ...options,
  });

  const db = drizzle({ client, relations });

  return { db, client };
}

export type Db = ReturnType<typeof initDb>["db"];
export type DbClient = ReturnType<typeof initDb>["client"];
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbTx = Db | Tx;
