import type { MiddlewareHandler } from "hono";
import type { Logger } from "@/pkg/logger";

const MAX_BODY_LENGTH = 10_000;
const REQUEST_LOG_LEVEL: Record<number, "error" | "warn" | "info"> = {
  2: "info",
  3: "info",
  4: "warn",
  5: "error",
};
const SENSITIVE_FIELDS = new Set([
  "accesstoken",
  "refreshtoken",
  "password",
  "token",
  "authorization",
  "key",
  "cookie",
  "set-cookie",
  "x-csrf-token",
]);

function sanitize(obj: unknown): unknown {
  return JSON.parse(
    JSON.stringify(obj, (key, value: unknown) => {
      if (SENSITIVE_FIELDS.has(key.toLowerCase())) {
        return "[REDACTED]";
      }
      return typeof value === "string"
        ? value.replace(
            /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|ek_[a-f0-9]{32}/g,
            "[REDACTED]"
          )
        : value;
    })
  );
}

function truncate(value: string) {
  if (value.length > MAX_BODY_LENGTH) {
    return `${value.slice(0, MAX_BODY_LENGTH)}...[truncated]`;
  }
  return value;
}

function parseBody(text: string, contentType: string | null): unknown {
  if (!text) {
    return undefined;
  }
  if ((contentType ?? "").includes("json")) {
    try {
      return JSON.parse(text);
    } catch {
      return truncate(text);
    }
  }
  return truncate(text);
}

export function initHTTPLoggerMiddleware(logger: Logger): MiddlewareHandler {
  return async (c, next) => {
    const start = performance.now();
    const child = logger.child({ reqId: c.get("requestId") });
    const method = c.req.method;
    const path = c.req.path;

    const requestBody = await parseBody(await c.req.text(), c.req.header("content-type") ?? null);

    // Skip logging for /docs and /doc endpoints to avoid cluttering logs with OpenAPI spec requests
    if (path.endsWith("/docs") || path.endsWith("/doc")) {
      await next();
      return;
    }

    await next();

    const status = c.res.status;
    const level = REQUEST_LOG_LEVEL[Math.floor(status / 100)] ?? "error";
    const resText = await c.res.clone().text();
    const responseBody = parseBody(resText, c.res.headers.get("content-type"));

    const logEntry: Record<string, unknown> = {
      req: {
        method,
        path,
        headers: Object.fromEntries(c.req.raw.headers.entries()),
        query: c.req.query(),
        body: requestBody,
      },
      res: {
        status,
        headers: Object.fromEntries(c.res.headers.entries()),
        body: responseBody,
        duration: Math.round(performance.now() - start),
      },
    };

    if (c.error) {
      logEntry.err = { type: c.error.name, message: c.error.message };
    }

    child[level](sanitize(logEntry), "request completed");
  };
}
