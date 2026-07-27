import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { initDb } from "@/pkg/db";
import type { Db } from "@/pkg/db";
import { initEnv } from "@/pkg/env";
import type { EnvSchema } from "@/pkg/env";

interface Deps {
  db: Db;
  env: EnvSchema;
}
function initApp(deps: Deps) {
  const app = new Hono();

  app.get("/", (c) => {
    return c.text(`Hello Hono is running in port: ${deps.env.PORT}!`);
  });

  return app;
}

const env = initEnv();
const db = initDb({ databaseUrl: env.DATABASE_URL });
const app = initApp({ db, env });

serve(
  {
    fetch: app.fetch,
    port: env.PORT,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port} (${env.NODE_ENV})`);
  }
);
