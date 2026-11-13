import { OpenAPIHono } from "@hono/zod-openapi";

import { initDeleteUserRoute } from "./delete";
import { initMeRoute } from "./me";

import type { AuthMiddleware } from "@/modules/auth/controllers/middleware";
import type { UserService } from "@/modules/user/service/interface";
import { handleDomainError } from "@/shared/handle-domain-error";

export function initUserRoutes(userService: UserService, authMiddleware: AuthMiddleware) {
  const app = new OpenAPIHono();
  app.route("/", initMeRoute({ userService, authMiddleware }));
  app.route("/", initDeleteUserRoute({ userService, authMiddleware }));

  app.onError(handleDomainError);

  return app;
}
