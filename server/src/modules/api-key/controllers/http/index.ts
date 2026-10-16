import { OpenAPIHono } from "@hono/zod-openapi";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { initDeleteApiKeyRoute } from "./delete";
import { initGenerateApiKeyRoute } from "./generate";
import { initListApiKeysRoute } from "./list";
import { initRevokeApiKeyRoute } from "./revoke";

import { ApiKeyError } from "@/modules/api-key/error";
import type { ApiKeyService } from "@/modules/api-key/service";
import type { AuthMiddleware } from "@/modules/auth/controllers/middleware";

export function initApiKeyRoutes(apiKeyService: ApiKeyService, authMiddleware: AuthMiddleware) {
  const app = new OpenAPIHono();

  const generateApiKeyRoute = initGenerateApiKeyRoute({ apiKeyService, authMiddleware });
  app.route("/", generateApiKeyRoute);

  const listApiKeysRoute = initListApiKeysRoute({ apiKeyService, authMiddleware });
  app.route("/", listApiKeysRoute);

  const revokeApiKeyRoute = initRevokeApiKeyRoute({ apiKeyService, authMiddleware });
  app.route("/", revokeApiKeyRoute);

  const deleteApiKeyRoute = initDeleteApiKeyRoute({ apiKeyService, authMiddleware });
  app.route("/", deleteApiKeyRoute);

  app.onError((err, c) => {
    if (err instanceof ApiKeyError) {
      return c.json(
        {
          success: false,
          message: err.message,
          error: err.code,
        },
        err.statusCode as ContentfulStatusCode
      );
    }
    throw err;
  });

  return app;
}
