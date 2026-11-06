import type { MiddlewareHandler } from "hono";
import { routePath } from "hono/route";
import type { Logger } from "@/pkg/logger";

const REQUEST_LOG_LEVEL: Record<number, "error" | "warn" | "info"> = {
  2: "info",
  3: "info",
  4: "warn",
  5: "error",
};
function redact(value: string): string {
  return value.replace(
    /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|ek_[a-f0-9]{32}/g,
    "[REDACTED]"
  );
}

export function initHTTPLoggerMiddleware(logger: Logger): MiddlewareHandler {
  return async (c, next) => {
    const start = performance.now();
    const child = logger.child({ reqId: redact(c.get("requestId")) });
    const method = c.req.method;
    const path = c.req.path;

    // Skip logging for /docs and /doc endpoints to avoid cluttering logs with OpenAPI spec requests
    if (path.endsWith("/docs") || path.endsWith("/doc")) {
      await next();
      return;
    }

    await next();

    const status = c.res.status;
    const level = REQUEST_LOG_LEVEL[Math.floor(status / 100)] ?? "error";
    const logEntry: Record<string, unknown> = {
      req: {
        method,
        // Route templates keep credentials in path parameters out of logs.
        route: routePath(c),
      },
      res: {
        status,
        duration: Math.round(performance.now() - start),
      },
    };

    if (c.error) {
      logEntry.err = { type: redact(c.error.name), message: redact(c.error.message) };
    }

    child[level](logEntry, "request completed");
  };
}
