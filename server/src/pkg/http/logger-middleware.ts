import type { MiddlewareHandler } from "hono";
import type { Logger } from "@/pkg/logger";

const MAX_BODY_LENGTH = 10_000;
const REQUEST_LOG_LEVEL: Record<number, "error" | "warn" | "info"> = {
  2: "info",
  3: "info",
  4: "warn",
  5: "error",
};
const SENSITIVE_PATTERNS = [
  {
    pattern: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
    replacement: "[REDACTED]",
  },
  {
    pattern: /"(accessToken|refreshToken|password|token|authorization)":\s*"[^"]*"/g,
    replacement: '"$1":"[REDACTED]"',
  },
];

function sanitize(obj: unknown): unknown {
  const json = JSON.stringify(obj);
  const redacted = SENSITIVE_PATTERNS.reduce(
    (str, { pattern, replacement }) => str.replace(pattern, replacement),
    json
  );
  return JSON.parse(redacted);
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

    const body = await parseBody(await c.req.text(), c.req.header("content-type") ?? null);

    await next();

    const status = c.res.status;
    const level = REQUEST_LOG_LEVEL[Math.floor(status / 100)] ?? "error";
    const resText = await c.res.clone().text();
    const responseBody = parseBody(resText, c.res.headers.get("content-type"));

    const logEntry: Record<string, unknown> = {
      method,
      path,
      headers: Object.fromEntries(c.req.raw.headers.entries()),
      query: c.req.query(),
      body,
      status,
      duration: Math.round(performance.now() - start),
      responseBody,
    };

    if (c.error) {
      logEntry.err = { type: c.error.name, message: c.error.message };
    }

    child[level](sanitize(logEntry), "request completed");
  };
}
