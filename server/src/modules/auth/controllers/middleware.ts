import type { MiddlewareHandler } from "hono";

import type { AuthService } from "@/modules/auth/service";

export function authMiddleware(
  secret: Uint8Array,
  authService: AuthService
): MiddlewareHandler<{ Variables: { userId: string } }> {
  return async (c, next) => {
    const auth = c.req.header("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return c.json(
        {
          success: false,
          message: "Missing Bearer header",
          error: "Unauthorized",
        },
        401
      );
    }
    try {
      const payload = await authService.verifyToken(auth.slice(7), secret);
      if (payload.sub === undefined) {
        return c.json(
          {
            success: false,
            message: "Invalid JWT payload",
            error: "Unauthorized",
          },
          401
        );
      }
      c.set("userId", payload.sub);
      await next();
    } catch {
      return c.json(
        {
          success: false,
          message: "Failed verifying JWT",
          error: "Unauthorized",
        },
        401
      );
    }
  };
}
