import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "node:path";

import { initTestDb } from "./helper";

const migrationsFolder = path.resolve(import.meta.dirname, "../pkg/db/migrations");

export default async function setup() {
  const { db, client } = await initTestDb();

  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await client.end();
  }
}
