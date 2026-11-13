import { getConnInfo } from "@hono/node-server/conninfo";

import type { Context } from "hono";
import type { BlankEnv } from "hono/types";
import { rateLimiter } from "hono-rate-limiter";
import type { Logger } from "@/pkg/logger";

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
  keyGenerator: (c: Context) => string;
}

/**
 * Create an in-memory HTTP rate limiter.
 * Policy names and policy-specific values belong in the shared layer.
 */
export function initRateLimit({ limit, windowMs, keyGenerator }: RateLimitOptions) {
  return rateLimiter<BlankEnv>({
    limit,
    windowMs,
    keyGenerator,
    handler: (c) =>
      c.json(
        {
          success: false,
          message: "Too many requests",
          error: "RATE_LIMITED",
        },
        429
      ),
  });
}

/**
 * Build a rate-limit key generator from an explicitly trusted proxy header,
 * or use the socket address when no trusted header is configured.
 */
export function initClientIp(
  logger: Logger,
  trustedHeader?: string
): RateLimitOptions["keyGenerator"] {
  return (c) => {
    if (trustedHeader) {
      const clientIp = c.req.header(trustedHeader)?.trim();
      if (clientIp) {
        return clientIp;
      }

      logger.warn({ trustedHeader }, "Trusted client IP header is missing; using unknown");
      return "unknown";
    }

    try {
      return getConnInfo(c).remote.address ?? "unknown";
    } catch {
      return "unknown";
    }
  };
}
