import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import { authMiddleware, rateLimit } from "@/modules/auth/controllers/middleware";
import type { AuthService } from "@/modules/auth/service";
import { userRespSchema } from "@/modules/user/zod-schema";
import { errorRespSchema, successRespSchema } from "@/shared/response.schema";

export function initMeRoute(authService: AuthService, accessSecret: Uint8Array) {
  const meResponseSchema = successRespSchema
    .extend({
      data: z.object({ user: userRespSchema }),
    })
    .openapi("MeResponse");

  const meRoute = createRoute({
    method: "get",
    path: "/me",
    security: [{ Bearer: [] }],
    middleware: [authMiddleware(accessSecret, authService), rateLimit(10)] as const,
    responses: {
      200: {
        content: { "application/json": { schema: meResponseSchema } },
        description: "Current user",
      },
      401: {
        content: { "application/json": { schema: errorRespSchema } },
        description: "Unauthorized",
      },
    },
  });

  const app = new OpenAPIHono();

  app.openapi(meRoute, async (c) => {
    const userId = c.get("userId");
    const user = await authService.getUser(userId);
    return c.json({ success: true, message: "get user success", data: { user } }, 200);
  });

  return app;
}
