import { rateLimiter } from "hono-rate-limiter";

interface RateLimitOptions {
  limit: number;
  minutes?: number;
}

export function rateLimit(options: RateLimitOptions) {
  const windowMs = (options.minutes ?? 1) * 60 * 1000;

  return rateLimiter({
    windowMs,
    limit: options.limit,
    keyGenerator: (c) => {
      const cfIp = c.req.header("cf-connecting-ip");
      if (cfIp) {
        return cfIp;
      }

      const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
      if (forwarded) {
        return forwarded;
      }

      return "unknown";
    },
  });
}
