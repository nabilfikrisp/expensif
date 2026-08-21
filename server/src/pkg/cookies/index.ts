import type { Context } from "hono";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";
import type { CookieOptions } from "hono/utils/cookie";

import type { EnvSchema } from "@/pkg/env";
import { API_VERSION } from "@/pkg/http";

export const REFRESH_TOKEN_COOKIE = "refresh_token";
export const CSRF_TOKEN_COOKIE = "csrf_token";

const AUTH_PATH = `/api/${API_VERSION}/auth`;

function baseCookieOptions(env: EnvSchema): CookieOptions {
  return {
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "Strict" : "Lax",
    path: AUTH_PATH,
  };
}

function refreshCookieOptions(env: EnvSchema): CookieOptions {
  return {
    ...baseCookieOptions(env),
    httpOnly: true,
    maxAge: 7 * 86400,
  };
}

function csrfCookieOptions(env: EnvSchema): CookieOptions {
  return {
    ...baseCookieOptions(env),
    maxAge: 7 * 86400,
  };
}

export function initCookieJar(env: EnvSchema) {
  const refreshOpts = refreshCookieOptions(env);
  const csrfOpts = csrfCookieOptions(env);

  return {
    setRefreshCookie: (c: Context, token: string) => {
      setCookie(c, REFRESH_TOKEN_COOKIE, token, refreshOpts);
    },
    getRefreshCookie: (c: Context) => getCookie(c, REFRESH_TOKEN_COOKIE),
    clearRefreshCookie: (c: Context) => {
      deleteCookie(c, REFRESH_TOKEN_COOKIE, { path: refreshOpts.path });
    },

    setCsrfCookie: (c: Context, token: string) => {
      setCookie(c, CSRF_TOKEN_COOKIE, token, csrfOpts);
    },
    getCsrfCookie: (c: Context) => getCookie(c, CSRF_TOKEN_COOKIE),
    clearCsrfCookie: (c: Context) => {
      deleteCookie(c, CSRF_TOKEN_COOKIE, { path: csrfOpts.path });
    },
  };
}

export type CookieJar = ReturnType<typeof initCookieJar>;
