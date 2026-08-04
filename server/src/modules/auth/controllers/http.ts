import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { rateLimiter } from "hono-rate-limiter";

import z from "zod";

import { authMiddleware } from "@/modules/auth/controllers/middleware";
import { AuthError } from "@/modules/auth/error";
import type { AuthService } from "@/modules/auth/service";
import type { EnvSchema } from "@/pkg/env";
import { API_VERSION } from "@/pkg/http";

export function initAuthRoutes(env: EnvSchema, authService: AuthService) {
  const app = new Hono();
  const accessSecret = authService.encodeSecret(env.JWT_SECRET);

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

  const registerSchema = z.object({
    email: z.email(),
    password: z.string().min(6),
    name: z.string().min(1),
  });
  app.post("/register", rateLimit(5), zValidator("json", registerSchema), async (c) => {
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

  const loginSchema = z.object({
    email: z.email(),
    password: z.string().min(1),
  });
  app.post("/login", rateLimit(10), zValidator("json", loginSchema), async (c) => {
    const { email, password } = c.req.valid("json");
    const result = await authService.login(email, password);
    setRefreshCookie(c, result.refreshToken);
    return c.json({
      success: true,
      message: "success",
      data: {
        accessToken: result.accessToken,
      },
    });
  });

  app.post("/refresh", rateLimit(20), async (c) => {
    const token = getRefreshCookie(c);
    if (!token) {
      return c.json(
        {
          success: false,
          message: "Missing refresh token",
          error: "Invalid request",
        },
        401
      );
    }
    const result = await authService.refresh(token);
    return c.json({
      success: true,
      message: "success",
      data: {
        accessToken: result.accessToken,
      },
    });
  });

  app.post("/logout", (c) => {
    clearRefreshCookie(c);
    return c.json({
      success: true,
      message: "log out success",
    });
  });

  app.get("/me", authMiddleware(accessSecret, authService), async (c) => {
    const userId = c.get("userId");
    const user = await authService.getUser(userId);
    return c.json({
      success: true,
      message: "get user success",
      data: {
        user,
      },
    });
  });

  app.onError((err, c) => {
    if (err instanceof AuthError) {
      return c.json(
        {
          success: false,
          message: "auth error",
          error: err.message,
        },
        err.statusCode as ContentfulStatusCode
      );
    }
    throw err;
  });

  return app;
}
