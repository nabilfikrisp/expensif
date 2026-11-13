import { OpenAPIHono } from "@hono/zod-openapi";

import { initChangePasswordRoute } from "./change-password";
import { initCsrfRoute } from "./csrf";
import { initLoginRoute } from "./login";
import { initLogoutRoute } from "./logout";
import { initLogoutAllRoute } from "./logout-all";
import { initRefreshRoute } from "./refresh";
import { initRegisterRoute } from "./register";

import type { AuthMiddleware } from "@/modules/auth/controllers/middleware";
import type { AuthUseCase } from "@/modules/auth/use-case/interface";
import { initCookieJar } from "@/pkg/cookies";
import type { EnvSchema } from "@/pkg/env";
import { handleDomainError } from "@/shared/handle-domain-error";
import type { RateLimiters } from "@/shared/rate-limit";

export interface InitAuthRoutesDeps {
  env: EnvSchema;
  authUseCase: AuthUseCase;
  authMiddleware: AuthMiddleware;
  rateLimiters: RateLimiters;
}
export function initAuthRoutes({
  env,
  authUseCase,
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

  app.onError(handleDomainError);

  return app;
}
