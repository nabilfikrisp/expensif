import { OpenAPIHono } from "@hono/zod-openapi";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { initLoginRoute } from "./login";
import { initLogoutRoute } from "./logout";
import { initMeRoute } from "./me";
import { initRefreshRoute } from "./refresh";
import { initRegisterRoute } from "./register";

import { AuthError } from "@/modules/auth/error";
import type { AuthService } from "@/modules/auth/service";
import { initCookieJar } from "@/pkg/cookies";
import type { EnvSchema } from "@/pkg/env";

export function initAuthRoutes(env: EnvSchema, authService: AuthService) {
  const app = new OpenAPIHono();
  const accessSecret = authService.encodeSecret(env.JWT_SECRET);
  const cookieJar = initCookieJar(env);

  const registerRoute = initRegisterRoute(authService, cookieJar);
  app.route("/", registerRoute);

  const loginRoute = initLoginRoute(authService, cookieJar);
  app.route("/", loginRoute);

  const refreshRoute = initRefreshRoute(authService, cookieJar);
  app.route("/", refreshRoute);

  const logoutRoute = initLogoutRoute(cookieJar);
  app.route("/", logoutRoute);

  const meRoute = initMeRoute(authService, accessSecret);
  app.route("/", meRoute);

  app.onError((err, c) => {
    if (err instanceof AuthError) {
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
