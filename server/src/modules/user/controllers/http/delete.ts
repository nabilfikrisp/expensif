import { OpenAPIHono, createRoute } from "@hono/zod-openapi";

import type { AuthMiddleware } from "@/modules/auth/controllers/middleware";
import type { UserService } from "@/modules/user/service/interface";
import { errorRespSchema, successRespSchema } from "@/shared/response.schema";

interface DeleteUserRouteDeps {
  userService: UserService;
  authMiddleware: AuthMiddleware;
}

export function initDeleteUserRoute(deps: DeleteUserRouteDeps) {
  const route = createRoute({
    method: "delete",
    path: "/me",
    security: [{ Bearer: [] }],
    middleware: [deps.authMiddleware] as const,
    responses: {
      200: {
        content: { "application/json": { schema: successRespSchema } },
        description: "Current user deleted, including owned data through database cascades",
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
  app.openapi(route, async (c) => {
    await deps.userService.deleteUser(c.get("userId"));
    return c.json({ success: true, message: "User deleted" }, 200);
  });
  return app;
}
