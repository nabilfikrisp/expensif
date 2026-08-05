# Auth Controller Refactor Plan

## Goal

Split the monolithic `auth/controllers/http.ts` (245 lines) into per-endpoint files with colocated schemas, and extract shared response schemas to a global location.

## Current Structure

```
auth/
  controllers/
    http.ts        ← 245 lines, 5 endpoints, all schemas, cookie helpers, route registration
    middleware.ts   ← stays as-is
  error.ts
  service.ts

pkg/http/
  index.ts         ← app init, global error handler (hardcodes error response shape)
  logger-middleware.ts
```

## Target Structure

```
auth/
  controllers/
    register.ts    ← registerReqSchema, tokenRespSchema (register variant), route + handler
    login.ts       ← loginReqSchema, route + handler
    refresh.ts     ← route + handler
    logout.ts      ← route + handler
    me.ts          ← meResponseSchema, route + handler
    middleware.ts   ← stays as-is
  error.ts
  service.ts

pkg/http/
  index.ts         ← imports errorRespSchema from response.ts for global error handler
  response.ts      ← NEW: errorRespSchema, successRespSchema + inferred types
  logger-middleware.ts
```

## Step 1: Create `pkg/http/response.ts`

Extract shared response schemas globally:

```typescript
import { z } from "@hono/zod-openapi";

export const errorRespSchema = z
  .object({
    success: z.boolean().openapi({ example: false }),
    message: z.string(),
    error: z.string(),
  })
  .openapi("ErrorResponse");

export const successRespSchema = z
  .object({
    success: z.boolean().openapi({ example: true }),
    message: z.string().openapi({ example: "success" }),
  })
  .openapi("SuccessResponse");

export type ErrorResponse = z.infer<typeof errorRespSchema>;
export type SuccessResponse = z.infer<typeof successRespSchema>;
```

## Step 2: Update `pkg/http/index.ts`

Replace hardcoded error response shapes in `useErrorHandler` with `errorRespSchema`:

```typescript
import { errorRespSchema } from "./response";

// In useErrorHandler:
app.onError((err, c) => {
  logger.error({ err }, "Internal server error");
  return c.json(
    { success: false, message: "application error", error: "Internal server error" },
    500
  );
});

app.notFound((c) => {
  return c.json(
    { success: false, message: "not found", error: "Not Found" },
    404
  );
});
```

Note: Keep the inline object literals here since `c.json()` needs a concrete value, not a schema. The schema is used for OpenAPI documentation and type inference, not runtime validation. The global error handler can reference the type for consistency but doesn't need to `.parse()` through it.

## Step 3: Create `auth/controllers/_shared.ts`

Extract shared auth-specific pieces:

```typescript
import { z } from "@hono/zod-openapi";
import { successRespSchema } from "@/pkg/http/response";

export const tokenRespSchema = successRespSchema
  .extend({
    data: z.object({ accessToken: z.string() }),
  })
  .openapi("TokenResponse");

export type TokenResponse = z.infer<typeof tokenRespSchema>;
```

Cookie helpers (`setRefreshCookie`, `getRefreshCookie`, `clearRefreshCookie`) stay in `_shared.ts` since they're used by multiple endpoints.

## Step 4: Split `auth/controllers/http.ts` into per-endpoint files

### `auth/controllers/register.ts`

- Imports: `registerReqSchema` (defined locally), `tokenRespSchema` from `_shared.ts`
- Exports: `registerReqSchema` (for reuse if needed), `registerRoute` (the OpenAPI route definition)
- Contains: route definition + handler

### `auth/controllers/login.ts`

- Imports: `tokenRespSchema` from `_shared.ts`
- Exports: `loginRoute`
- Contains: `loginReqSchema` (defined locally), route definition + handler

### `auth/controllers/refresh.ts`

- Imports: `tokenRespSchema` from `_shared.ts`
- Exports: `refreshRoute`
- Contains: route definition + handler

### `auth/controllers/logout.ts`

- Imports: `successRespSchema` from `@/pkg/http/response`
- Exports: `logoutRoute`
- Contains: route definition + handler

### `auth/controllers/me.ts`

- Imports: `successRespSchema` from `@/pkg/http/response`, `userRespSchema` from `@/modules/user/zod-schema`
- Exports: `meRoute`
- Contains: `meResponseSchema` (defined locally, extends `successRespSchema`), route definition + handler

## Step 5: Update `auth/controllers/http.ts` → `auth/controllers/index.ts`

Replace the monolith with a thin aggregator that imports and registers all routes:

```typescript
import { OpenAPIHono } from "@hono/zod-openapi";
import type { EnvSchema } from "@/pkg/env";
import type { AuthService } from "@/modules/auth/service";
import { authMiddleware } from "./middleware";
import { rateLimiter } from "hono-rate-limiter";

import { registerRoute } from "./register";
import { loginRoute } from "./login";
import { refreshRoute } from "./refresh";
import { logoutRoute } from "./logout";
import { meRoute } from "./me";

export function initAuthRoutes(env: EnvSchema, authService: AuthService) {
  const app = new OpenAPIHono();
  const accessSecret = authService.encodeSecret(env.JWT_SECRET);

  const rateLimit = (limit: number) =>
    rateLimiter({
      windowMs: 1 * 60 * 1000,
      limit,
      keyGenerator: (c) => c.req.header("x-forwarded-for") ?? "",
    });

  app.openapi(registerRoute(authService, rateLimit), ...);
  app.openapi(loginRoute(authService, rateLimit), ...);
  app.openapi(refreshRoute(authService, rateLimit), ...);
  app.openapi(logoutRoute(rateLimit), ...);
  app.openapi(meRoute(authService, accessSecret, rateLimit), ...);

  app.onError((err, c) => { ... });

  return app;
}
```

Each route export is a function that takes `authService` (and other deps) and returns the route definition + handler pair. This keeps dependencies explicit and testable.

## Step 6: Update tests

```typescript
import type { TokenResponse } from "@/modules/auth/controllers/_shared";

const body = await res.json() as TokenResponse;
expectTypeOf(body.data.accessToken).toBe("string");
```

## Summary of Changes

| File | Action |
|------|--------|
| `pkg/http/response.ts` | CREATE — shared error/success response schemas |
| `pkg/http/index.ts` | EDIT — import from response.ts |
| `auth/controllers/_shared.ts` | CREATE — tokenRespSchema, cookie helpers |
| `auth/controllers/register.ts` | CREATE — register endpoint |
| `auth/controllers/login.ts` | CREATE — login endpoint |
| `auth/controllers/refresh.ts` | CREATE — refresh endpoint |
| `auth/controllers/logout.ts` | CREATE — logout endpoint |
| `auth/controllers/me.ts` | CREATE — me endpoint |
| `auth/controllers/http.ts` | DELETE — replaced by index.ts |
| `auth/controllers/index.ts` | CREATE — thin aggregator |
| `server/src/test/auth.test.ts` | EDIT — import TokenResponse type |
