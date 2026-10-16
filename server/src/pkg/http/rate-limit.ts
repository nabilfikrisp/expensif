import { getConnInfo } from "@hono/node-server/conninfo";

import type { Context } from "hono";
import { rateLimiter } from "hono-rate-limiter";

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
  return rateLimiter({
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
export function initClientIp(trustedHeader?: string): RateLimitOptions["keyGenerator"] {
  return (c) => {
    if (trustedHeader) {
      const clientIp = c.req.header(trustedHeader)?.trim();
      if (clientIp) {
        return clientIp;
      }

      console.warn(
        `[rate-limit] Trusted client IP header "${trustedHeader}" is missing; using "unknown".`
      );
      return "unknown";
    }

    try {
      return getConnInfo(c).remote.address ?? "unknown";
    } catch {
      return "unknown";
    }
  };
}
