import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import type { ApiKeyService } from "@/modules/api-key/service/interface";
import type { AuthMiddleware } from "@/modules/auth/controllers/middleware";
import { errorRespSchema, successRespSchema } from "@/shared/response.schema";

const generateApiKeyReqSchema = z
  .object({
    label: z.string().optional().openapi({ example: "telegram link" }),
  })
  .openapi("GenerateApiKeyBody");

export const generateApiKeyRespSchema = successRespSchema
  .extend({
    data: z.object({
      id: z.string(),
      keyHint: z.string(),
      label: z.string().nullable(),
      createdAt: z.string(),
      expiresAt: z.string(),
      key: z.string(),
    }),
  })
  .openapi("GenerateApiKeyResponse");

interface GenerateApiKeyRouteDeps {
  apiKeyService: ApiKeyService;
  authMiddleware: AuthMiddleware;
}
export function initGenerateApiKeyRoute(deps: GenerateApiKeyRouteDeps) {
  const generateApiKeyRoute = createRoute({
    method: "post",
    path: "/",
    security: [{ Bearer: [] }],
    request: { body: { content: { "application/json": { schema: generateApiKeyReqSchema } } } },
    middleware: [deps.authMiddleware] as const,
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
          expiresAt: result.expiresAt,
        },
      },
      201
    );
  });

  return app;
}
