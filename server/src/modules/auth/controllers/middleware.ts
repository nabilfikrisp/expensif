import type { MiddlewareHandler } from "hono";
import { rateLimiter } from "hono-rate-limiter";

import { AuthError } from "@/modules/auth/error";
import type { AuthService } from "@/modules/auth/service";

export function authMiddleware(
  secret: Uint8Array,
  authService: AuthService
): MiddlewareHandler<{ Variables: { userId: string } }> {
  return async (c, next) => {
    const auth = c.req.header("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      throw AuthError.missingBearerHeader();
    }
    try {
      const payload = await authService.verifyToken(auth.slice(7), secret);
      if (payload.sub === undefined) {
        throw AuthError.invalidJwtPayload();
      }
      c.set("userId", payload.sub);
      await next();
    } catch {
      throw AuthError.failedVerifyingJwt();
    }
  };
}

export function rateLimit(limit: number) {
  return rateLimiter({
    windowMs: 1 * 60 * 1000,
    limit,
    keyGenerator: (c) => c.req.header("x-forwarded-for") ?? "",
  });
}
