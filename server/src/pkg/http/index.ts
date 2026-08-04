import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";

import { initHTTPLoggerMiddleware } from "./logger-middleware";
import type { EnvSchema } from "@/pkg/env";
import type { Logger } from "@/pkg/logger";

export const API_VERSION = "v1";

export function initHttp(env: EnvSchema, logger: Logger, authRoutes: Hono) {
  const app = new Hono();
  const HTTPLoggerMiddleware = initHTTPLoggerMiddleware(logger);

  app.use(secureHeaders());
  app.use(requestId());
  app.use(HTTPLoggerMiddleware);

  app.get("/", (c) => c.text(`Hello Hono is running in port: ${env.PORT}!`));
  app.route("/api/v1/auth", authRoutes);

  app.onError((err, c) => {
    logger.error({ err }, "Internal server error");
    return c.json(
      {
        success: false,
        message: "application error",
        error: "Internal server error",
      },
      500
    );
  });

  return app;
}

export function startHttp(app: Hono, logger: Logger, port: number) {
  serve({ fetch: app.fetch, port }, (info) => {
    logger.info(`Server is running on http://localhost:${info.port}`);
  });
}
