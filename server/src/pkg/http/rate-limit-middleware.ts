import { getConnInfo } from "@hono/node-server/conninfo";
import type { Context, Next } from "hono";
import { rateLimiter } from "hono-rate-limiter";

import { DEFAULT_RATE_LIMIT } from "@/shared/consts";

interface RateLimitOptions {
  limit?: number;
  minutes?: number;
}

const FALLBACK = "127.0.0.1";

export function rateLimit(options?: RateLimitOptions) {
  if (process.env.NODE_ENV === "test") {
    return (_c: Context, next: Next) => {
      return next();
    };
  }

  const windowMs = (options?.minutes ?? 1) * 60 * 1000;

  return rateLimiter({
    windowMs,
    limit: options?.limit ?? DEFAULT_RATE_LIMIT,
    keyGenerator: (c) => {
      const cfIp = c.req.header("cf-connecting-ip");
      if (cfIp) {
        return cfIp;
      }

      const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
      if (forwarded) {
        return forwarded;
      }

      const info = getConnInfo(c);
      if (info.remote.address) {
        return info.remote.address;
      }

      return FALLBACK;
    },
  });
}
