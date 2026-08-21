import type { MiddlewareHandler } from "hono";
import type { JWTPayload } from "jose";

import { AuthError } from "@/modules/auth/error";

export type VerifyTokenFn = (token: string) => Promise<JWTPayload>;

export function authMiddleware(
  verifyToken: VerifyTokenFn
): MiddlewareHandler<{ Variables: { userId: string } }> {
  return async (c, next) => {
    const auth = c.req.header("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      throw AuthError.missingBearerHeader();
    }
    try {
      const payload = await verifyToken(auth.slice(7));
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
