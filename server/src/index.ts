import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { Env } from "./pkg/env/env.js";

function createApp(env: Env) {
  const app = new Hono();

  app.get("/", (c) => {
    return c.text("Hello Hono asf!");
  });

  return app;
}

const env = new Env();
const app = createApp(env);

serve(
  {
    fetch: app.fetch,
    port: env.PORT,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port} (${env.NODE_ENV})`);
  }
);
