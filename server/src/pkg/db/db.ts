import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { relations } from "./relations.js";

interface Deps {
  databaseUrl: string;
}
export function initDb(deps: Deps) {
  const client = createClient({ url: deps.databaseUrl });
  const db = drizzle({ client, relations });
  return db;
}

export type Db = ReturnType<typeof initDb>;
