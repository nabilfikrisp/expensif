import { OpenAPIHono, createRoute } from "@hono/zod-openapi";

import type { CookieJar } from "@/pkg/cookies";
import { successRespSchema } from "@/shared/response.schema";

const logoutRespSchema = successRespSchema;

const logoutRoute = createRoute({
  method: "post",
  path: "/logout",
  responses: {
    200: {
      content: { "application/json": { schema: logoutRespSchema } },
      description: "Logged out",
    },
  },
});

export function initLogoutRoute(cookieJar: CookieJar) {
  const app = new OpenAPIHono();

  app.openapi(logoutRoute, (c) => {
    cookieJar.clearRefreshCookie(c);
    cookieJar.clearCsrfCookie(c);
    return c.json({ success: true, message: "log out success" }, 200);
  });

  return app;
}
