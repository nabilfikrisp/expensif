import { serve } from "@hono/node-server";
import type { Hono } from "hono";

export function startHttp(app: Hono, port: number) {
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  });
}
