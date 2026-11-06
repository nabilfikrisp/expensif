import { OpenAPIHono } from "@hono/zod-openapi";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { initDeleteUserRoute } from "./delete";

import type { AuthMiddleware } from "@/modules/auth/controllers/middleware";
import { AuthError } from "@/modules/auth/error";
import { UserError } from "@/modules/user/error";
import type { UserService } from "@/modules/user/service";

export function initUserRoutes(userService: UserService, authMiddleware: AuthMiddleware) {
  const app = new OpenAPIHono();
  app.route("/", initDeleteUserRoute({ userService, authMiddleware }));

  app.onError((err, c) => {
    if (err instanceof UserError || err instanceof AuthError) {
      return c.json(
        { success: false, message: err.message, error: err.code },
        err.statusCode as ContentfulStatusCode
      );
    }
    throw err;
  });

  return app;
}
