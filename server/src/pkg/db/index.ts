import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import type { EnvSchema } from "../env/env.js";
import { relations } from "./relations.js";

interface Deps {
  env: EnvSchema;
}
export function initDb(deps: Deps) {
  const client = createClient({ url: deps.env.DATABASE_URL });
  const db = drizzle({ client, relations });
  return db;
}
