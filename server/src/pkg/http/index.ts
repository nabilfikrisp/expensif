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

interface RouteModule {
  prefix: string;
  app: OpenAPIHono;
}

export function initHttp(env: EnvSchema, logger: Logger, routes: RouteModule[]) {
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

  for (const route of routes) {
    app.route(`${API_PREFIX}/${route.prefix}`, route.app);
  }

  app.openAPIRegistry.registerComponent("securitySchemes", "Bearer", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
  });

  app.doc(`${API_PREFIX}/doc`, {
    openapi: "3.0.0",
    info: { title: "Expensif API", version: API_VERSION },
    servers: [{ url: "/" }],
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
