import { OpenAPIHono } from "@hono/zod-openapi";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { initChangePasswordRoute } from "./change-password";
import { initCsrfRoute } from "./csrf";
import { initLoginRoute } from "./login";
import { initLogoutRoute } from "./logout";
import { initLogoutAllRoute } from "./logout-all";
import { initMeRoute } from "./me";
import { initRefreshRoute } from "./refresh";
import { initRegisterRoute } from "./register";

import type { AuthMiddleware } from "@/modules/auth/controllers/middleware";
import { AuthError } from "@/modules/auth/error";
import type { AuthUseCase } from "@/modules/auth/use-case";
import { UserError } from "@/modules/user/error";
import type { UserService } from "@/modules/user/service";
import { initCookieJar } from "@/pkg/cookies";
import type { EnvSchema } from "@/pkg/env";
import type { RateLimiters } from "@/shared/rate-limit";

export interface InitAuthRoutesDeps {
  env: EnvSchema;
  authUseCase: AuthUseCase;
  userService: UserService;
  authMiddleware: AuthMiddleware;
  rateLimiters: RateLimiters;
}
export function initAuthRoutes({
  env,
  authUseCase,
  userService,
  authMiddleware,
  rateLimiters,
}: InitAuthRoutesDeps) {
  const app = new OpenAPIHono();
  app.use(async (c, next) => {
    c.header("Cache-Control", "no-store");
    await next();
  });

  const cookieJar = initCookieJar(env);
  app.route("/", initCsrfRoute(cookieJar));
  app.route(
    "/",
    initChangePasswordRoute(authUseCase, cookieJar, authMiddleware, rateLimiters.changePassword)
  );

  const registerRoute = initRegisterRoute(authUseCase, cookieJar, rateLimiters.register);
  app.route("/", registerRoute);

  const loginRoute = initLoginRoute(authUseCase, cookieJar, rateLimiters.login);
  app.route("/", loginRoute);

  const refreshRoute = initRefreshRoute(authUseCase, cookieJar);
  app.route("/", refreshRoute);

  app.route(
    "/",
    initLogoutAllRoute(authUseCase, cookieJar, authMiddleware, rateLimiters.logoutAll)
  );

  const logoutRoute = initLogoutRoute(authUseCase, cookieJar);
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
