import { OpenAPIHono } from "@hono/zod-openapi";

import { initDeleteLinkedAccountRoute } from "./delete";
import { initListLinkedAccountsRoute } from "./list";

import type { AuthMiddleware } from "@/modules/auth/controllers/middleware";
import type { LinkedAccountService } from "@/modules/linked-account/service";
import { handleDomainError } from "@/shared/handle-domain-error";

export function initLinkedAccountRoutes(
  linkedAccountService: LinkedAccountService,
  authMiddleware: AuthMiddleware
) {
  const app = new OpenAPIHono();

  const listLinkedAccountsRoute = initListLinkedAccountsRoute({
    linkedAccountService,
    authMiddleware,
  });
  app.route("/", listLinkedAccountsRoute);

  const deleteLinkedAccountRoute = initDeleteLinkedAccountRoute({
    linkedAccountService,
    authMiddleware,
  });
  app.route("/", deleteLinkedAccountRoute);

  app.onError(handleDomainError);

  return app;
}
