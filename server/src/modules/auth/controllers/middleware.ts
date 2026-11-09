import type { MiddlewareHandler } from "hono";
import type { JWTPayload } from "jose";

import { AuthError, isTokenVerificationError } from "@/modules/auth/error";

export type VerifyTokenFn = (token: string) => Promise<JWTPayload>;

export function initAuthMiddleware(
  verifyToken: VerifyTokenFn
): MiddlewareHandler<{ Variables: { userId: string } }> {
  return async (c, next) => {
    const auth = c.req.header("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      throw AuthError.missingBearerHeader();
    }
    let payload: JWTPayload;
    try {
      payload = await verifyToken(auth.slice(7));
    } catch (error) {
      if (isTokenVerificationError(error)) {
        throw AuthError.failedVerifyingJwt();
      }
      throw error;
    }
    if (payload.sub === undefined) {
      throw AuthError.invalidJwtPayload();
    }
    c.set("userId", payload.sub);
    await next();
  };
}

export type AuthMiddleware = ReturnType<typeof initAuthMiddleware>;
