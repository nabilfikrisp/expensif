import { OpenAPIHono, createRoute } from "@hono/zod-openapi";

import { AuthError } from "@/modules/auth/error";
import type { AuthUseCase } from "@/modules/auth/use-case/interface";
import type { CookieJar } from "@/pkg/cookies";
import { errorRespSchema, successRespSchema } from "@/shared/response.schema";

const logoutRespSchema = successRespSchema;

const logoutRoute = createRoute({
  method: "post",
  path: "/logout",
  responses: {
    200: {
      content: { "application/json": { schema: logoutRespSchema } },
      description: "Logged out",
    },
    403: {
      content: { "application/json": { schema: errorRespSchema } },
      description: "Missing or invalid CSRF proof for a supplied refresh cookie",
    },
    500: {
      content: { "application/json": { schema: errorRespSchema } },
      description: "Session revocation failed; cookies are cleared",
    },
  },
});

export function initLogoutRoute(authUseCase: AuthUseCase, cookieJar: CookieJar) {
  const app = new OpenAPIHono();

  app.openapi(logoutRoute, async (c) => {
    const token = cookieJar.getRefreshCookie(c);
    if (token) {
      const csrfCookie = cookieJar.getCsrfCookie(c);
      if (!csrfCookie || csrfCookie !== c.req.header("X-CSRF-Token")) {
        throw AuthError.invalidCsrfToken();
      }
    }
    try {
      await authUseCase.logout(token);
    } finally {
      cookieJar.clearRefreshCookie(c);
      cookieJar.clearCsrfCookie(c);
    }
    return c.json({ success: true, message: "log out success" }, 200);
  });

  return app;
}
