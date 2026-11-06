import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import type { AuthService } from "@/modules/auth/service";
import type { CookieJar } from "@/pkg/cookies";
import type { RateLimitMiddleware } from "@/shared/rate-limit";
import { errorRespSchema, tokenRespSchema } from "@/shared/response.schema";

export const loginReqSchema = z
  .object({
    email: z.email().openapi({ example: "user@example.com" }),
    password: z.string().min(1).openapi({ example: "password123" }),
  })
  .openapi("LoginBody");

export const loginRespSchema = tokenRespSchema;

export function initLoginRoute(
  authService: AuthService,
  cookieJar: CookieJar,
  rateLimiter: RateLimitMiddleware
) {
  const loginRoute = createRoute({
    method: "post",
    path: "/login",
    request: { body: { content: { "application/json": { schema: loginReqSchema } } } },
    middleware: [rateLimiter],
    responses: {
      200: {
        content: { "application/json": { schema: loginRespSchema } },
        description: "Login success",
      },
      401: {
        content: { "application/json": { schema: errorRespSchema } },
        description: "Invalid credentials",
      },
    },
  });

  const app = new OpenAPIHono();

  app.openapi(loginRoute, async (c) => {
    const { email, password } = c.req.valid("json");
    const result = await authService.login(email, password);
    cookieJar.setRefreshCookie(c, result.refreshToken);
    cookieJar.setCsrfCookie(c, result.csrfToken);
    return c.json(
      { success: true, message: "success", data: { accessToken: result.accessToken } },
      200
    );
  });

  return app;
}
