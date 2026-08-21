import { OpenAPIHono, createRoute } from "@hono/zod-openapi";

import type { ApiKeyService } from "@/modules/api-key/service";
import { listApiKeysQuerySchema } from "@/modules/api-key/service";
import { apiKeyRespSchema } from "@/modules/api-key/zod-schema";
import { authMiddleware } from "@/modules/auth/controllers/middleware";
import type { VerifyTokenFn } from "@/modules/auth/controllers/middleware";
import { rateLimit } from "@/pkg/http/rate-limit-middleware";
import { errorRespSchema, paginatedRespSchema } from "@/shared/response.schema";

const listApiKeysRespSchema = paginatedRespSchema(apiKeyRespSchema);

interface ListApiKeysRouteDeps {
  apiKeyService: ApiKeyService;
  verifyToken: VerifyTokenFn;
}
export function initListApiKeysRoute(deps: ListApiKeysRouteDeps) {
  const listApiKeysRoute = createRoute({
    method: "get",
    path: "/",
    security: [{ Bearer: [] }],
    request: { query: listApiKeysQuerySchema },
    middleware: [authMiddleware(deps.verifyToken), rateLimit({ limit: 50 })] as const,
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
