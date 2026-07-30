import { serve } from "@hono/node-server";
import { Hono } from "hono";
import type { Db } from "@/pkg/db";
import type { EnvSchema } from "@/pkg/env";

export function initHttp(env: EnvSchema, db: Db) {
  const app = new Hono();
  app.get("/", (c) => c.text(`Hello Hono is running in port: ${env.PORT}!`));
  return app;
}

export function startHttp(app: Hono, port: number) {
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  });
}
