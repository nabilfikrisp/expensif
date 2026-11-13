import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import type { AuthMiddleware } from "@/modules/auth/controllers/middleware";
import type { LinkedAccountService } from "@/modules/linked-account/service/interface";
import { errorRespSchema, successRespSchema } from "@/shared/response.schema";

const deleteLinkedAccountParamsSchema = z
  .object({
    id: z.uuid().openapi({ example: "550e8400-e29b-41d4-a716-446655440000" }),
  })
  .openapi("DeleteLinkedAccountParams");

interface DeleteLinkedAccountRouteDeps {
  linkedAccountService: LinkedAccountService;
  authMiddleware: AuthMiddleware;
}

export function initDeleteLinkedAccountRoute(deps: DeleteLinkedAccountRouteDeps) {
  const deleteLinkedAccountRoute = createRoute({
    method: "delete",
    path: "/{id}",
    security: [{ Bearer: [] }],
    request: { params: deleteLinkedAccountParamsSchema },
    middleware: [deps.authMiddleware] as const,
    responses: {
      200: {
        content: { "application/json": { schema: successRespSchema } },
        description: "Account unlinked",
      },
      401: {
        content: { "application/json": { schema: errorRespSchema } },
        description: "Unauthorized",
      },
      404: {
        content: { "application/json": { schema: errorRespSchema } },
        description: "Account not found",
      },
    },
  });

  const app = new OpenAPIHono();

  app.openapi(deleteLinkedAccountRoute, async (c) => {
    const userId = c.get("userId");
    const { id } = c.req.valid("param");

    await deps.linkedAccountService.unlinkAccount(userId, id);

    return c.json({ success: true, message: "Account unlinked" }, 200);
  });

  return app;
}
