import { serve } from "@hono/node-server";
import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { rateLimiter } from "hono-rate-limiter";

import { initHTTPLoggerMiddleware } from "./logger-middleware";
import type { EnvSchema } from "@/pkg/env";
import type { Logger } from "@/pkg/logger";

export const API_VERSION = "v1";
const API_PREFIX = `/api/${API_VERSION}`;

export function initHttp(env: EnvSchema, logger: Logger, authRoutes: OpenAPIHono) {
  const app = new OpenAPIHono();
  const HTTPLoggerMiddleware = initHTTPLoggerMiddleware(logger);

  app.use(secureHeaders());
  app.use(requestId());
  app.use(HTTPLoggerMiddleware);

  app.use(
    rateLimiter({
      windowMs: 15 * 60 * 1000,
      limit: 100,
      keyGenerator: (c) => c.req.header("x-forwarded-for") ?? "",
    })
  );

  app.get("/", (c) => c.text(`Hello Hono is running in port: ${env.PORT}!`));
  app.route(`${API_PREFIX}/auth`, authRoutes);

  authRoutes.openAPIRegistry.registerComponent("securitySchemes", "Bearer", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
  });

  app.get(`${API_PREFIX}/doc`, (c) => {
    const spec = authRoutes.getOpenAPI31Document({
      openapi: "3.0.0",
      info: { title: "Expensif API", version: API_VERSION },
      servers: [{ url: `${API_PREFIX}/auth` }],
    });
    return c.json(spec);
  });

  app.get(`${API_PREFIX}/docs`, Scalar({ url: `${API_PREFIX}/doc` }));

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

export function startHttp(app: OpenAPIHono, logger: Logger, port: number) {
  const server = serve({ fetch: app.fetch, port }, (info) => {
    logger.info(`Server is running on http://localhost:${info.port}`);
  });
  return server;
}
