import { OpenAPIHono } from "@hono/zod-openapi";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { initDeleteApiKeyRoute } from "./delete";
import { initGenerateApiKeyRoute } from "./generate";
import { initListApiKeysRoute } from "./list";
import { initRevokeApiKeyRoute } from "./revoke";

import { ApiKeyError } from "@/modules/api-key/error";
import type { ApiKeyService } from "@/modules/api-key/service";
import type { AuthService } from "@/modules/auth/service";
import type { EnvSchema } from "@/pkg/env";

export function initApiKeyRoutes(
  env: EnvSchema,
  apiKeyService: ApiKeyService,
  authService: AuthService
) {
  const app = new OpenAPIHono();

  const accessSecret = authService.encodeSecret(env.JWT_SECRET);
  const verifyToken = (token: string) => authService.verifyToken(token, accessSecret);

  const generateApiKeyRoute = initGenerateApiKeyRoute({ apiKeyService, verifyToken });
  app.route("/", generateApiKeyRoute);

  const listApiKeysRoute = initListApiKeysRoute({ apiKeyService, verifyToken });
  app.route("/", listApiKeysRoute);

  const revokeApiKeyRoute = initRevokeApiKeyRoute({ apiKeyService, verifyToken });
  app.route("/", revokeApiKeyRoute);

  const deleteApiKeyRoute = initDeleteApiKeyRoute({ apiKeyService, verifyToken });
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
