import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import { apiKeyRespSchema } from "@/modules/api-key/controllers/zod-schema";
import type { ApiKeyService } from "@/modules/api-key/service/interface";
import type { AuthMiddleware } from "@/modules/auth/controllers/middleware";
import { errorRespSchema, paginatedRespSchema } from "@/shared/response.schema";

const listApiKeysQuerySchema = z
  .object({
    label: z.string().optional().openapi({ example: "telegram" }),
    status: z.enum(["active", "revoked", "all"]).default("active").openapi({ example: "active" }),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
  })
  .openapi("ListApiKeysQuery");

export const listApiKeysRespSchema = paginatedRespSchema(apiKeyRespSchema);

interface ListApiKeysRouteDeps {
  apiKeyService: ApiKeyService;
  authMiddleware: AuthMiddleware;
}
export function initListApiKeysRoute(deps: ListApiKeysRouteDeps) {
  const listApiKeysRoute = createRoute({
    method: "get",
    path: "/",
    security: [{ Bearer: [] }],
    request: { query: listApiKeysQuerySchema },
    middleware: [deps.authMiddleware] as const,
    responses: {
      200: {
        content: { "application/json": { schema: listApiKeysRespSchema } },
        description: "List of API keys",
      },
      401: {
        content: { "application/json": { schema: errorRespSchema } },
        description: "Unauthorized",
      },
    },
  });

  const app = new OpenAPIHono();

  app.openapi(listApiKeysRoute, async (c) => {
    const userId = c.get("userId");
    const filters = c.req.valid("query");

    const result = await deps.apiKeyService.listApiKeys(userId, filters);

    return c.json(
      { success: true, message: "success", data: result.data, pagination: result.pagination },
      200
    );
  });

  return app;
}
