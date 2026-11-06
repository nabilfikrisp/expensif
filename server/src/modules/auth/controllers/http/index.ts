import { OpenAPIHono } from "@hono/zod-openapi";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { initLoginRoute } from "./login";
import { initLogoutRoute } from "./logout";
import { initMeRoute } from "./me";
import { initRefreshRoute } from "./refresh";
import { initRegisterRoute } from "./register";

import type { AuthMiddleware } from "@/modules/auth/controllers/middleware";
import { AuthError } from "@/modules/auth/error";
import type { AuthService } from "@/modules/auth/service";
import { UserError } from "@/modules/user/error";
import type { UserService } from "@/modules/user/service";
import { initCookieJar } from "@/pkg/cookies";
import type { EnvSchema } from "@/pkg/env";
import type { RateLimiters } from "@/shared/rate-limit";

export interface InitAuthRoutesDeps {
  env: EnvSchema;
  authService: AuthService;
  userService: UserService;
  authMiddleware: AuthMiddleware;
  rateLimiters: RateLimiters;
}
export function initAuthRoutes({
  env,
  authService,
  userService,
  authMiddleware,
  rateLimiters,
}: InitAuthRoutesDeps) {
  const app = new OpenAPIHono();

  const cookieJar = initCookieJar(env);

  const registerRoute = initRegisterRoute(authService, cookieJar, rateLimiters.register);
  app.route("/", registerRoute);

  const loginRoute = initLoginRoute(authService, cookieJar, rateLimiters.login);
  app.route("/", loginRoute);

  const refreshRoute = initRefreshRoute(authService, cookieJar);
  app.route("/", refreshRoute);

  const logoutRoute = initLogoutRoute(cookieJar);
  app.route("/", logoutRoute);

  const meRoute = initMeRoute({ userService, authMiddleware });
  app.route("/", meRoute);

  app.onError((err, c) => {
    if (err instanceof AuthError || err instanceof UserError) {
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
