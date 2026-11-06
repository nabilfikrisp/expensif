import { OpenAPIHono } from "@hono/zod-openapi";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { initDeleteLinkedAccountRoute } from "./delete";
import { initListLinkedAccountsRoute } from "./list";

import type { AuthMiddleware } from "@/modules/auth/controllers/middleware";
import { AuthError } from "@/modules/auth/error";
import { LinkedAccountError } from "@/modules/linked-account/error";
import type { LinkedAccountService } from "@/modules/linked-account/service";

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

  app.onError((err, c) => {
    if (err instanceof LinkedAccountError || err instanceof AuthError) {
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
