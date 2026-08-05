import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { rateLimiter } from "hono-rate-limiter";

import { authMiddleware } from "@/modules/auth/controllers/middleware";
import { AuthError } from "@/modules/auth/error";
import type { AuthService } from "@/modules/auth/service";
import { userRespSchema } from "@/modules/user/zod-schema";
import type { EnvSchema } from "@/pkg/env";
import { API_VERSION } from "@/pkg/http";

export function initAuthRoutes(env: EnvSchema, authService: AuthService) {
  const app = new OpenAPIHono();
  const accessSecret = authService.encodeSecret(env.JWT_SECRET);

  const errorRespSchema = z
    .object({
      success: z.boolean().openapi({ example: false }),
      message: z.string(),
      error: z.string(),
    })
    .openapi("ErrorResponse");

  const successRespSchema = z
    .object({
      success: z.boolean().openapi({ example: true }),
      message: z.string().openapi({ example: "success" }),
    })
    .openapi("SuccessResponse");

  const tokenRespSchema = successRespSchema
    .extend({
      data: z.object({ accessToken: z.string() }),
    })
    .openapi("TokenResponse");

  const rateLimit = (limit: number) =>
    rateLimiter({
      windowMs: 1 * 60 * 1000,
      limit,
      keyGenerator: (c) => c.req.header("x-forwarded-for") ?? "",
    });

  function setRefreshCookie(c: Context, token: string) {
    setCookie(c, "refresh_token", token, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: env.NODE_ENV === "production" ? "Strict" : "Lax",
      path: `/api/${API_VERSION}/auth`,
      maxAge: 7 * 86400,
    });
  }

  function getRefreshCookie(c: Context) {
    const token = getCookie(c, "refresh_token");
    return token;
  }

  function clearRefreshCookie(c: Context) {
    deleteCookie(c, "refresh_token", { path: `/api/${API_VERSION}/auth` });
  }

  const registerReqSchema = z
    .object({
      email: z.email().openapi({ example: "user@example.com" }),
      password: z.string().min(6).openapi({ example: "password123" }),
      name: z.string().min(1).openapi({ example: "John Doe" }),
    })
    .openapi("RegisterBody");

  const registerRoute = createRoute({
    method: "post",
    path: "/register",
    middleware: [rateLimit(5)],
    request: {
      body: { content: { "application/json": { schema: registerReqSchema } } },
    },
    responses: {
      201: {
        content: { "application/json": { schema: tokenRespSchema } },
        description: "User registered",
      },
      400: {
        content: { "application/json": { schema: errorRespSchema } },
        description: "Validation error",
      },
      409: {
        content: { "application/json": { schema: errorRespSchema } },
        description: "Email already registered",
      },
    },
  });

  app.openapi(registerRoute, async (c) => {
    const { email, password, name } = c.req.valid("json");
    const result = await authService.register(email, password, name);
    setRefreshCookie(c, result.refreshToken);
    return c.json(
      {
        success: true,
        message: "success",
        data: {
          accessToken: result.accessToken,
        },
      },
      201
    );
  });

  const loginReqSchema = z
    .object({
      email: z.email().openapi({ example: "user@example.com" }),
      password: z.string().min(1).openapi({ example: "password123" }),
    })
    .openapi("LoginBody");

  const loginRoute = createRoute({
    method: "post",
    path: "/login",
    middleware: [rateLimit(10)],
    request: {
      body: { content: { "application/json": { schema: loginReqSchema } } },
    },
    responses: {
      200: {
        content: { "application/json": { schema: tokenRespSchema } },
        description: "Login success",
      },
      401: {
        content: { "application/json": { schema: errorRespSchema } },
        description: "Invalid credentials",
      },
    },
  });

  app.openapi(loginRoute, async (c) => {
    const { email, password } = c.req.valid("json");
    const result = await authService.login(email, password);
    setRefreshCookie(c, result.refreshToken);
    return c.json(
      {
        success: true,
        message: "success",
        data: { accessToken: result.accessToken },
      },
      200
    );
  });

  const refreshRoute = createRoute({
    method: "post",
    path: "/refresh",
    middleware: [rateLimit(10)],
    responses: {
      200: {
        content: { "application/json": { schema: tokenRespSchema } },
        description: "Token refreshed",
      },
      401: {
        content: { "application/json": { schema: errorRespSchema } },
        description: "Missing/invalid refresh token",
      },
    },
  });

  app.openapi(refreshRoute, async (c) => {
    const token = getRefreshCookie(c);
    if (!token) {
      throw AuthError.invalidToken();
    }
    const result = await authService.refresh(token);
    return c.json(
      {
        success: true,
        message: "success",
        data: { accessToken: result.accessToken },
      },
      200
    );
  });

  const logoutRoute = createRoute({
    method: "post",
    path: "/logout",
    responses: {
      200: {
        content: { "application/json": { schema: successRespSchema } },
        description: "Logged out",
      },
    },
  });

  app.openapi(logoutRoute, (c) => {
    clearRefreshCookie(c);
    return c.json({ success: true, message: "log out success" });
  });

  const meResponseSchema = successRespSchema
    .extend({
      data: z.object({ user: userRespSchema }),
    })
    .openapi("MeResponse");

  const meRoute = createRoute({
    method: "get",
    path: "/me",
    security: [{ Bearer: [] }],
    middleware: [authMiddleware(accessSecret, authService)] as const,
    responses: {
      200: {
        content: { "application/json": { schema: meResponseSchema } },
        description: "Current user",
      },
      401: {
        content: { "application/json": { schema: errorRespSchema } },
        description: "Unauthorized",
      },
    },
  });

  app.openapi(meRoute, async (c) => {
    const userId = c.get("userId");
    const user = await authService.getUser(userId);
    return c.json({ success: true, message: "get user success", data: { user } }, 200);
  });

  app.onError((err, c) => {
    if (err instanceof AuthError) {
      return c.json(
        {
          success: false,
          message: "Auth Error",
          error: err.message,
        },
        err.statusCode as ContentfulStatusCode
      );
    }
    throw err;
  });

  return app;
}
