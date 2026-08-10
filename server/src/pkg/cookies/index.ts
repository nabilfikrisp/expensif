import type { Context } from "hono";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";
import type { CookieOptions } from "hono/utils/cookie";

import type { EnvSchema } from "@/pkg/env";
import { API_VERSION } from "@/pkg/http";

export const REFRESH_TOKEN_COOKIE = "refresh_token";
export function getRefreshCookieOptions(env: EnvSchema): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "Strict" : "Lax",
    path: `/api/${API_VERSION}/auth`,
    maxAge: 7 * 86400,
  };
}
export function initCookieJar(env: EnvSchema) {
  const options = getRefreshCookieOptions(env);

  return {
    setRefreshCookie: (c: Context, token: string) => {
      setCookie(c, REFRESH_TOKEN_COOKIE, token, options);
    },
    getRefreshCookie: (c: Context) => getCookie(c, REFRESH_TOKEN_COOKIE),
    clearRefreshCookie: (c: Context) => {
      deleteCookie(c, REFRESH_TOKEN_COOKIE, { path: options.path });
    },
  };
}
export type CookieJar = ReturnType<typeof initCookieJar>;
