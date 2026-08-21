import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import type { ApiKeyService } from "@/modules/api-key/service";
import { apiKeyRespSchema } from "@/modules/api-key/zod-schema";
import { authMiddleware } from "@/modules/auth/controllers/middleware";
import type { VerifyTokenFn } from "@/modules/auth/controllers/middleware";
import { rateLimit } from "@/pkg/http/rate-limit-middleware";
import { errorRespSchema, successRespSchema } from "@/shared/response.schema";

const generateApiKeyReqSchema = z
  .object({
    label: z.string().optional().openapi({ example: "telegram link" }),
  })
  .openapi("GenerateApiKeyBody");

const generateApiKeyRespSchema = successRespSchema
  .extend({
    data: apiKeyRespSchema.extend({ key: z.string() }).omit({ lastUsedAt: true, revokedAt: true }),
  })
  .openapi("GenerateApiKeyResponse");

interface GenerateApiKeyRouteDeps {
  apiKeyService: ApiKeyService;
  verifyToken: VerifyTokenFn;
}
export function initGenerateApiKeyRoute(deps: GenerateApiKeyRouteDeps) {
  const generateApiKeyRoute = createRoute({
    method: "post",
    path: "/",
    security: [{ Bearer: [] }],
    request: { body: { content: { "application/json": { schema: generateApiKeyReqSchema } } } },
    middleware: [authMiddleware(deps.verifyToken), rateLimit({ limit: 50 })] as const,
    responses: {
      201: {
        content: { "application/json": { schema: generateApiKeyRespSchema } },
        description: "API key generated",
      },
      401: {
        content: { "application/json": { schema: errorRespSchema } },
        description: "Unauthorized",
      },
    },
  });

  const app = new OpenAPIHono();

  app.openapi(generateApiKeyRoute, async (c) => {
    const userId = c.get("userId");
    const { label } = c.req.valid("json");

    const result = await deps.apiKeyService.generateApiKey(userId, label);

    return c.json(
      {
        success: true,
        message: "API key generated",
        data: {
          id: result.id,
          key: result.key,
          keyHint: result.keyHint,
          label: result.label,
          createdAt: result.createdAt,
        },
      },
      201
    );
  });

  return app;
}
