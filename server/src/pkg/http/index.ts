import { serve } from "@hono/node-server";
import { Hono } from "hono";

import type { EnvSchema } from "@/pkg/env";

export function initHttp(env: EnvSchema, authRoutes: Hono) {
  const app = new Hono();
  app.get("/", (c) => c.text(`Hello Hono is running in port: ${env.PORT}!`));
  app.route("/auth", authRoutes);

  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: "Internal server error" }, 500);
  });

  return app;
}

export function startHttp(app: Hono, port: number) {
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  });
}
