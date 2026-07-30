import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import z from "zod";

import { authMiddleware } from "@/modules/auth/controllers/middleware";
import { AuthError } from "@/modules/auth/error";
import type { AuthService } from "@/modules/auth/service";
import type { EnvSchema } from "@/pkg/env";

const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
  name: z.string().min(1),
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export function initAuthRoutes(env: EnvSchema, authService: AuthService) {
  const app = new Hono();
  const accessSecret = authService.encodeSecret(env.JWT_SECRET);

  function setRefreshCookie(c: Context, token: string) {
    setCookie(c, "refresh_token", token, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "Strict",
      path: "/auth",
      maxAge: 7 * 86400,
    });
  }

  function getRefreshCookie(c: Context) {
    const token = getCookie(c, "refresh_token");
    return token;
  }

  function clearRefreshCookie(c: Context) {
    deleteCookie(c, "refresh_token", { path: "/auth" });
  }

  app.post("/register", zValidator("json", registerSchema), async (c) => {
    const { email, password, name } = c.req.valid("json");
    const result = await authService.register(email, password, name);
    setRefreshCookie(c, result.refreshToken);
    return c.json({ accessToken: result.accessToken }, 201);
  });

  app.post("/login", zValidator("json", loginSchema), async (c) => {
    const { email, password } = c.req.valid("json");
    const result = await authService.login(email, password);
    setRefreshCookie(c, result.refreshToken);
    return c.json({ accessToken: result.accessToken });
  });

  app.post("/refresh", async (c) => {
    const token = getRefreshCookie(c);
    if (!token) {
      return c.json({ error: "Missing refresh token" }, 401);
    }
    const result = await authService.refresh(token);
    return c.json({ accessToken: result.accessToken });
  });

  app.post("/logout", (c) => {
    clearRefreshCookie(c);
    return c.json({ message: "logged out" });
  });

  app.get("/me", authMiddleware(accessSecret, authService), async (c) => {
    const userId = c.get("userId");
    const user = await authService.getUser(userId);
    return c.json(user);
  });

  app.onError((err, c) => {
    if (err instanceof AuthError) {
      return c.json({ error: err.message }, err.statusCode as ContentfulStatusCode);
    }
    throw err;
  });

  return app;
}
