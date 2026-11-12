import { OpenAPIHono } from "@hono/zod-openapi";

import { initDeleteApiKeyRoute } from "./delete";
import { initGenerateApiKeyRoute } from "./generate";
import { initListApiKeysRoute } from "./list";
import { initRevokeApiKeyRoute } from "./revoke";

import type { ApiKeyService } from "@/modules/api-key/service";
import type { AuthMiddleware } from "@/modules/auth/controllers/middleware";
import { handleDomainError } from "@/shared/handle-domain-error";

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

  app.onError(handleDomainError);

  return app;
}
