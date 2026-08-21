import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import { authMiddleware } from "@/modules/auth/controllers/middleware";
import type { VerifyTokenFn } from "@/modules/auth/controllers/middleware";
import type { AuthService } from "@/modules/auth/service";
import { userRespSchema } from "@/modules/user/zod-schema";
import { rateLimit } from "@/pkg/http/rate-limit-middleware";
import { errorRespSchema, successRespSchema } from "@/shared/response.schema";

export const meRespSchema = successRespSchema
  .extend({
    data: z.object({ user: userRespSchema }),
  })
  .openapi("MeResponse");

interface MeRouteDeps {
  authService: AuthService;
  verifyToken: VerifyTokenFn;
}
export function initMeRoute(deps: MeRouteDeps) {
  const meRoute = createRoute({
    method: "get",
    path: "/me",
    security: [{ Bearer: [] }],
    middleware: [
      authMiddleware(deps.verifyToken),
      rateLimit({
        limit: 10,
      }),
    ] as const,
    responses: {
      200: {
        content: { "application/json": { schema: meRespSchema } },
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
    const user = await deps.authService.getUser(userId);
    return c.json({ success: true, message: "get user success", data: { user } }, 200);
  });

  return app;
}
