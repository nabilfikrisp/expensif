import { OpenAPIHono } from "@hono/zod-openapi";
import pino from "pino";
import assert from "node:assert/strict";

import { csrfRespSchema, initCsrfRoute } from "@/modules/auth/controllers/http/csrf";
import { initCookieJar } from "@/pkg/cookies";
import type { EnvSchema } from "@/pkg/env";
import { initHttp } from "@/pkg/http";

const env: EnvSchema = {
  NODE_ENV: "production",
  PORT: 3000,
  DEPLOY_PROXY: "none",
  API_ORIGIN: "https://api.example.com",
  FRONTEND_ORIGIN: "https://app.example.com",
  DATABASE_URL: "unused",
  TELEGRAM_BOT_TOKEN: "unused",
  OPENROUTER_API_KEY: "unused",
  OPENROUTER_MODEL: "unused",
  JWT_SECRET: "unused",
  ACCESS_TOKEN_EXPIRES_IN_MINUTES: "5m",
  SESSION_IDLE_SECONDS: 7200,
  SESSION_ABSOLUTE_SECONDS: 86400,
  API_KEY_SECRET: "unused",
  API_KEY_REDEEM_WINDOW_MINUTES: 15,
};

const jar = initCookieJar(env);
const auth = new OpenAPIHono();
auth.route("/", initCsrfRoute(jar));
let writes = 0;
const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
auth.post("/cookie-probe", (c) => {
  writes++;
  jar.setRefreshCookie(c, "opaque-refresh", expiresAt);
  jar.setCsrfCookie(c, "csrf-proof", expiresAt);
  return c.json({ success: true });
});
const app = initHttp(env, pino({ level: "silent" }), [{ prefix: "auth", app: auth }], {
  defaultLimiter: async (_c, next) => next(),
});
const csrfUrl = `${env.API_ORIGIN}/api/v1/auth/csrf`;

for (const origin of [env.FRONTEND_ORIGIN, env.API_ORIGIN]) {
  const bootstrap = await app.request(csrfUrl, {
    headers: { Origin: origin, Cookie: "csrf_token=csrf-proof" },
  });
  assert.equal(bootstrap.status, 200);
  assert.equal(bootstrap.headers.get("Access-Control-Allow-Origin"), origin);
  assert.equal(bootstrap.headers.get("Access-Control-Allow-Credentials"), "true");
  assert.match(bootstrap.headers.get("Vary") ?? "", /Origin/i);
  assert.equal(bootstrap.headers.get("Cache-Control"), "no-store");
  assert.equal(csrfRespSchema.parse(await bootstrap.json()).data.csrfToken, "csrf-proof");
  assert.deepEqual(bootstrap.headers.getSetCookie(), []);

  const preflight = await app.request(`${env.API_ORIGIN}/api/v1/auth/refresh`, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type,x-csrf-token",
    },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), origin);
  assert.match(preflight.headers.get("Access-Control-Allow-Headers") ?? "", /X-CSRF-Token/i);
}

for (const origin of ["https://evil.example.com", "https://app.example.com.evil.test", "null"]) {
  for (const method of ["GET", "POST", "OPTIONS"]) {
    const path = method === "GET" ? "csrf" : "cookie-probe";
    const response = await app.request(`${env.API_ORIGIN}/api/v1/auth/${path}`, {
      method,
      headers: {
        Origin: origin,
        Cookie: "csrf_token=csrf-proof",
        Host: new URL(origin === "null" ? "https://evil.test" : origin).host,
        "X-Forwarded-Proto": "https",
      },
    });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
    assert.deepEqual(response.headers.getSetCookie(), []);
  }
}
assert.equal(writes, 0);

const missing = await app.request(csrfUrl, { headers: { Origin: env.FRONTEND_ORIGIN } });
assert.equal(missing.status, 401);
assert.equal(missing.headers.get("Cache-Control"), "no-store");
assert.deepEqual(missing.headers.getSetCookie(), []);

// Origin-less API clients remain supported; this probe does not bypass auth-route CSRF checks.
const cookiesResponse = await app.request(`${env.API_ORIGIN}/api/v1/auth/cookie-probe`, {
  method: "POST",
});
assert.equal(cookiesResponse.status, 200);
const cookies = cookiesResponse.headers.getSetCookie();
const refreshCookie = cookies.find((cookie) => cookie.startsWith("refresh_token="));
assert.ok(refreshCookie);
assert.match(refreshCookie, /HttpOnly/i);
assert.match(refreshCookie, /Secure/i);
assert.match(refreshCookie, /SameSite=Strict/i);
assert.match(refreshCookie, /Path=\/api\/v1\/auth/i);
assert.ok(refreshCookie.includes(`Expires=${new Date(expiresAt).toUTCString()}`));
assert.doesNotMatch(refreshCookie, /Domain=/i);
assert.doesNotMatch(
  cookies.find((cookie) => cookie.startsWith("csrf_token=csrf-proof")) ?? "",
  /Domain=/i
);

console.log("Auth origin, CSRF bootstrap, preflight, and cookie checks passed.");
