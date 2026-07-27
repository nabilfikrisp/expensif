import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { relations } from "./relations.js";

export function initDb(databaseUrl: string) {
  const client = createClient({ url: databaseUrl });
  const db = drizzle({ client, relations });
  return db;
}

export type Db = ReturnType<typeof initDb>;
