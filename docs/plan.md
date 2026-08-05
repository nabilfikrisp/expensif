# Plan: Multi-Module OpenAPI Docs (Option A — Auto-Merge)

## Overview

Extend the OpenAPI/Scalar docs setup so **all HTTP modules** (auth, expense, category, user, etc.) are included in a single unified spec. Uses `OpenAPIHono`'s built-in `.route()` merging — child `OpenAPIHono` apps are automatically merged into the parent's spec.

## Current State

- Main app is `OpenAPIHono` (in `server/src/pkg/http/index.ts`)
- `authRoutes` is a separate `OpenAPIHono` mounted at `/api/v1/auth`
- Spec is currently generated manually via `authRoutes.getOpenAPI31Document()` (workaround because we never tested auto-merge)
- Bearer security scheme is registered on `authRoutes.openAPIRegistry`
- Only `auth` has HTTP routes today; `expense` has bot routes only; `category`, `message`, `user` are schema-only

## Goal

When a new module adds HTTP routes as an `OpenAPIHono` sub-app and is mounted with `app.route()`, it **automatically appears** in the OpenAPI spec at `/api/v1/doc` and in Scalar at `/api/v1/docs` — no manual spec merging needed.

## Steps

### 1. Verify auto-merge works

Before refactoring, test that `app.doc()` on the main `OpenAPIHono` includes routes from a child `OpenAPIHono` mounted via `.route()`.

In `server/src/pkg/http/index.ts`:
- Replace the manual `authRoutes.getOpenAPI31Document()` endpoint with `app.doc()`
- Check if `/api/v1/doc` returns all auth routes

If auto-merge works → proceed to step 2.
If it doesn't → fall back to collecting route definitions manually (see Appendix A).

### 2. Refactor `initHttp` to accept variadic route modules

**File:** `server/src/pkg/http/index.ts`

Change the function signature from:
```ts
export function initHttp(env: EnvSchema, logger: Logger, authRoutes: OpenAPIHono)
```
To:
```ts
type RouteModule = { prefix: string; app: OpenAPIHono };

export function initHttp(env: EnvSchema, logger: Logger, routes: RouteModule[])
```

Mount all routes in a loop:
```ts
for (const route of routes) {
  app.route(`${API_PREFIX}${route.prefix}`, route.app);
}
```

### 3. Move Bearer security scheme to main app

Move the `registerComponent` call from the auth controller or from the post-mount workaround to the main app's registry, so it applies globally:

```ts
app.openAPIRegistry.registerComponent("securitySchemes", "Bearer", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
});
```

### 4. Use `app.doc()` for spec generation

Replace the manual spec endpoint:
```ts
app.doc(`${API_PREFIX}/doc`, {
  openapi: "3.0.0",
  info: { title: "Expensif API", version: API_VERSION },
  servers: [{ url: API_PREFIX }],
});
```

Scalar stays the same:
```ts
app.get(`${API_PREFIX}/docs`, Scalar({ url: `${API_PREFIX}/doc` }));
```

### 5. Update entry point (`server/src/index.ts`)

Pass route modules as an array:
```ts
const app = initHttp(env, logger, [
  { prefix: "/auth", app: authRoutes },
]);
```

When adding future modules:
```ts
const app = initHttp(env, logger, [
  { prefix: "/auth", app: authRoutes },
  { prefix: "/expense", app: expenseRoutes },  // future
  { prefix: "/category", app: categoryRoutes }, // future
]);
```

### 6. Clean up auth controller

- Remove `openAPIRegistry.registerComponent("securitySchemes", "Bearer", ...)` from `initHttp` (moved to step 3)
- Remove the manual `getOpenAPI31Document()` call
- The auth `OpenAPIHono` just defines routes — no spec generation logic

### 7. Verify

- `pnpm lint`
- `pnpm run format:check`
- `pnpm dev` — confirm Scalar UI loads and shows all mounted routes
- Confirm new modules auto-appear in spec when added to the routes array

## Files Changed

| File | Change |
|---|---|
| `server/src/pkg/http/index.ts` | Refactor `initHttp` to accept `RouteModule[]`, use `app.doc()`, move Bearer scheme |
| `server/src/index.ts` | Pass routes as array to `initHttp` |
| `server/src/modules/auth/controllers/http.ts` | Remove spec-related code if any remains |

## Appendix A: Fallback if auto-merge doesn't work

If `app.doc()` doesn't include child routes, the fallback is to manually merge specs:

```ts
app.get(`${API_PREFIX}/doc`, (c) => {
  const specs = routes.map((r) => r.app.getOpenAPI31Document({...}));
  const merged = mergeOpenAPISpecs(specs); // custom merge utility
  return c.json(merged);
});
```

Or use the `openapi-routes` batch registration pattern (Option B from the original discussion).

## Appendix B: Adding a new module (future)

Once this plan is implemented, adding HTTP docs for a new module is:

1. Create `server/src/modules/<module>/controllers/http.ts`
2. Use `new OpenAPIHono()` + `createRoute()` + `app.openapi()` (same pattern as auth)
3. Export the `OpenAPIHono` instance
4. Add `{ prefix: "/<module>", app: <module>Routes }` to the routes array in `index.ts`
5. Done — spec and Scalar UI auto-update
