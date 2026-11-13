import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import type { AuthMiddleware } from "@/modules/auth/controllers/middleware";
import { AuthError } from "@/modules/auth/error";
import type { AuthUseCase } from "@/modules/auth/use-case/interface";
import type { CookieJar } from "@/pkg/cookies";
import type { RateLimitMiddleware } from "@/shared/rate-limit";
import { errorRespSchema, successRespSchema } from "@/shared/response.schema";

export const logoutAllReqSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
  })
  .strict()
  .openapi("LogoutAllBody");

export function initLogoutAllRoute(
  authUseCase: AuthUseCase,
  cookieJar: CookieJar,
  authMiddleware: AuthMiddleware,
  rateLimiter: RateLimitMiddleware
) {
  const route = createRoute({
    method: "post",
    path: "/logout-all",
    security: [{ Bearer: [] }],
    description:
      "Verify the current password and log out all devices for the authenticated user. Send X-CSRF-Token obtained from GET /auth/csrf with credentials included. Success revokes all refresh sessions and clears cookies; discard the access token and sign in again. Existing access JWTs expire naturally.",
    middleware: [rateLimiter, authMiddleware] as const,
    request: { body: { content: { "application/json": { schema: logoutAllReqSchema } } } },
    responses: {
      200: {
        content: { "application/json": { schema: successRespSchema } },
        description: "All sessions revoked; sign in again",
      },
      400: {
        content: { "application/json": { schema: errorRespSchema } },
        description: "Invalid password input",
      },
      401: {
        content: { "application/json": { schema: errorRespSchema } },
        description: "Invalid authentication or current password",
      },
      403: {
        content: { "application/json": { schema: errorRespSchema } },
        description: "Invalid CSRF proof or disallowed origin",
      },
      429: { description: "Too many authentication attempts" },
      500: {
        content: { "application/json": { schema: errorRespSchema } },
        description: "Session revocation failed",
      },
    },
  });
  const app = new OpenAPIHono();
  app.openapi(route, async (c) => {
    const csrfToken = cookieJar.getCsrfCookie(c);
    if (!csrfToken || csrfToken !== c.req.header("X-CSRF-Token")) {
      throw AuthError.invalidCsrfToken();
    }
    const { currentPassword } = c.req.valid("json");
    await authUseCase.logoutAll(c.get("userId"), currentPassword);
    cookieJar.clearRefreshCookie(c);
    cookieJar.clearCsrfCookie(c);
    return c.json(
      { success: true, message: "Logged out of all devices. Please sign in again." },
      200
    );
  });
  return app;
}
