import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import type { CookieJar } from "@/pkg/cookies";
import { errorRespSchema, successRespSchema } from "@/shared/response.schema";

export const csrfRespSchema = successRespSchema
  .extend({
    data: z.object({ csrfToken: z.string() }),
  })
  .openapi("CsrfResponse");

const csrfRoute = createRoute({
  method: "get",
  path: "/csrf",
  description:
    "Read the API's CSRF cookie using credentials: include after login or page reload, and before refresh or logout. Send the returned value in X-CSRF-Token. A refresh that rotates cookies requires reading the token again. This endpoint does not create or extend a session or cookie.",
  responses: {
    200: {
      content: { "application/json": { schema: csrfRespSchema } },
      description: "Current CSRF token; response must not be cached",
    },
    401: {
      content: { "application/json": { schema: errorRespSchema } },
      description: "No CSRF cookie; sign in again",
    },
    403: {
      content: { "application/json": { schema: errorRespSchema } },
      description: "Origin is not allowed",
    },
  },
});

export function initCsrfRoute(cookieJar: CookieJar) {
  const app = new OpenAPIHono();
  app.openapi(csrfRoute, (c) => {
    c.header("Cache-Control", "no-store");
    const csrfToken = cookieJar.getCsrfCookie(c);
    if (!csrfToken) {
      return c.json(
        { success: false, message: "Sign in to obtain a CSRF token", error: "CSRF_COOKIE_MISSING" },
        401
      );
    }
    return c.json({ success: true, message: "success", data: { csrfToken } }, 200);
  });
  return app;
}
