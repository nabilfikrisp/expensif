import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { relations } from "./relations.js";

export function initDb(databaseUrl: string) {
  const client = createClient({ url: databaseUrl });
  const db = drizzle({ client, relations });
  return { db, client };
}

export type Db = ReturnType<typeof initDb>["db"];
export type DbClient = ReturnType<typeof initDb>["client"];
