import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import type { AuthMiddleware } from "@/modules/auth/controllers/middleware";
import type { LinkedAccountService } from "@/modules/linked-account/service";
import { linkedAccountRespSchema } from "@/modules/linked-account/zod-schema";
import { errorRespSchema } from "@/shared/response.schema";

const listLinkedAccountsRespSchema = z
  .object({
    success: z.boolean(),
    message: z.string(),
    data: z.array(linkedAccountRespSchema),
  })
  .openapi("ListLinkedAccountsResponse");

interface ListLinkedAccountsRouteDeps {
  linkedAccountService: LinkedAccountService;
  authMiddleware: AuthMiddleware;
}

export function initListLinkedAccountsRoute(deps: ListLinkedAccountsRouteDeps) {
  const listLinkedAccountsRoute = createRoute({
    method: "get",
    path: "/",
    security: [{ Bearer: [] }],
    middleware: [deps.authMiddleware] as const,
    responses: {
      200: {
        content: { "application/json": { schema: listLinkedAccountsRespSchema } },
        description: "List of linked accounts",
      },
      401: {
        content: { "application/json": { schema: errorRespSchema } },
        description: "Unauthorized",
      },
    },
  });

  const app = new OpenAPIHono();

  app.openapi(listLinkedAccountsRoute, async (c) => {
    const userId = c.get("userId");
    const data = await deps.linkedAccountService.listLinkedAccounts(userId);

    return c.json({ success: true, message: "success", data }, 200);
  });

  return app;
}
