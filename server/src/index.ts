import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { initEnv } from "./pkg/env/env.js";
import type { EnvSchema } from "./pkg/env/env.js";

function initApp(env: EnvSchema) {
  const app = new Hono();

  app.get("/", (c) => {
    return c.text(`Hello Hono is running in port: ${env.PORT}!`);
  });

  return app;
}

const env = initEnv();
const app = initApp(env);

serve(
  {
    fetch: app.fetch,
    port: env.PORT,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port} (${env.NODE_ENV})`);
  }
);
