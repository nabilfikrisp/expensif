import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import type { ApiKeyService } from "@/modules/api-key/service";
import { authMiddleware } from "@/modules/auth/controllers/middleware";
import type { VerifyTokenFn } from "@/modules/auth/controllers/middleware";
import { rateLimit } from "@/pkg/http/rate-limit-middleware";
import { errorRespSchema, successRespSchema } from "@/shared/response.schema";

const revokeApiKeyParamsSchema = z
  .object({
    id: z.uuid().openapi({ example: "550e8400-e29b-41d4-a716-446655440000" }),
  })
  .openapi("RevokeApiKeyParams");

interface RevokeApiKeyRouteDeps {
  apiKeyService: ApiKeyService;
  verifyToken: VerifyTokenFn;
}
export function initRevokeApiKeyRoute(deps: RevokeApiKeyRouteDeps) {
  const revokeApiKeyRoute = createRoute({
    method: "patch",
    path: "/{id}",
    security: [{ Bearer: [] }],
    request: { params: revokeApiKeyParamsSchema },
    middleware: [authMiddleware(deps.verifyToken), rateLimit({ limit: 50 })] as const,
    responses: {
      200: {
        content: { "application/json": { schema: successRespSchema } },
        description: "API key revoked",
      },
      401: {
        content: { "application/json": { schema: errorRespSchema } },
        description: "Unauthorized",
      },
      404: {
        content: { "application/json": { schema: errorRespSchema } },
        description: "API key not found",
      },
    },
  });

  const app = new OpenAPIHono();

  app.openapi(revokeApiKeyRoute, async (c) => {
    const userId = c.get("userId");
    const { id } = c.req.valid("param");

    await deps.apiKeyService.revokeApiKey(userId, id);

    return c.json({ success: true, message: "API key revoked" }, 200);
  });

  return app;
}
