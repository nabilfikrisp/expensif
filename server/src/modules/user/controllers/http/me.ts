import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import type { AuthMiddleware } from "@/modules/auth/controllers/middleware";
import { userRespSchema } from "@/modules/user/controllers/zod-schema";
import type { UserService } from "@/modules/user/service/interface";
import { errorRespSchema, successRespSchema } from "@/shared/response.schema";

export const meRespSchema = successRespSchema
  .extend({
    data: z.object({ user: userRespSchema }),
  })
  .openapi("MeResponse");

interface MeRouteDeps {
  userService: UserService;
  authMiddleware: AuthMiddleware;
}
export function initMeRoute(deps: MeRouteDeps) {
  const meRoute = createRoute({
    method: "get",
    path: "/me",
    security: [{ Bearer: [] }],
    middleware: [deps.authMiddleware] as const,
    responses: {
      200: {
        content: { "application/json": { schema: meRespSchema } },
        description: "Current user",
      },
      401: {
        content: { "application/json": { schema: errorRespSchema } },
        description: "Unauthorized",
      },
      404: {
        content: { "application/json": { schema: errorRespSchema } },
        description: "User not found",
      },
    },
  });

  const app = new OpenAPIHono();

  app.get("/me", async (c, next) => {
    c.header("Cache-Control", "no-store");
    await next();
  });

  app.openapi(meRoute, async (c) => {
    const userId = c.get("userId");
    const user = await deps.userService.getUser(userId);
    return c.json({ success: true, message: "get user success", data: { user } }, 200);
  });

  return app;
}
