import { OpenAPIHono, createRoute } from "@hono/zod-openapi";

import { AuthError } from "@/modules/auth/error";
import type { AuthService } from "@/modules/auth/service";
import type { CookieJar } from "@/pkg/cookies";
import { rateLimit } from "@/pkg/http/rate-limit-middleware";
import { errorRespSchema, tokenRespSchema } from "@/shared/response.schema";

const refreshRespSchema = tokenRespSchema;

const refreshRoute = createRoute({
  method: "post",
  path: "/refresh",
  middleware: [
    rateLimit({
      limit: 50,
    }),
  ],
  responses: {
    200: {
      content: { "application/json": { schema: refreshRespSchema } },
      description: "Token refreshed",
    },
    401: {
      content: { "application/json": { schema: errorRespSchema } },
      description: "Missing/invalid refresh token",
    },
  },
});

export function initRefreshRoute(authService: AuthService, cookieJar: CookieJar) {
  const app = new OpenAPIHono();

  app.openapi(refreshRoute, async (c) => {
    const token = cookieJar.getRefreshCookie(c);
    if (!token) {
      throw AuthError.invalidToken();
    }

    const csrfCookie = cookieJar.getCsrfCookie(c);
    const csrfHeader = c.req.header("X-CSRF-Token");
    if (!csrfCookie || csrfCookie !== csrfHeader) {
      throw AuthError.invalidCsrfToken();
    }

    const { accessToken, refreshToken, csrfToken } = await authService.refresh(token);
    cookieJar.setRefreshCookie(c, refreshToken);
    cookieJar.setCsrfCookie(c, csrfToken);
    return c.json({ success: true, message: "success", data: { accessToken } }, 200);
  });

  return app;
}
