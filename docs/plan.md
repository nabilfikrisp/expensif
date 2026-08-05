# Plan: Add Scalar API Docs to the Expensif Server

## Overview

Add interactive API documentation using **Scalar** to the Hono HTTP server. The integration uses `@hono/zod-openapi` to generate an OpenAPI spec from the existing Zod-based routes, and `@hono/scalar` to serve the interactive docs UI.

## Scope

- **Auth routes only**: `/register`, `/login`, `/refresh`, `/logout`, `/me` (the only HTTP-exposed routes today).
- Expense routes are Telegram bot commands (not HTTP), so they are out of scope.
- No DB schema changes → no migrations needed.

## Decisions

- Docs UI served at `/docs`, OpenAPI JSON at `/doc`.
- Spec generated from route definitions via `@hono/zod-openapi` (not a static OpenAPI file).

## Steps

### 1. Add dependencies (`server/package.json`)

Install:
- `@hono/zod-openapi` — provides `OpenAPIHono` and `createRoute`.
- `@hono/scalar` — serves the Scalar UI and `/doc` JSON.

### 2. Refactor auth controller to `OpenAPIHono` (`server/src/modules/auth/controllers/http.ts`)

- Switch `new Hono()` → `new OpenAPIHono()`.
- Reuse existing Zod schemas (`registerSchema`, `loginSchema`) and define route objects via `createRoute` for all 5 endpoints:
  - `POST /register` — 201 + 400/409
  - `POST /login` — 200 + 401
  - `POST /refresh` — 200 + 401
  - `POST /logout` — 200
  - `GET /me` — 200 + 401, **Bearer** security
- Response schemas follow the existing `{ success, message, data }` envelope shape.
- Replace `app.post`/`app.get` handlers with `app.openapi(route, handler)`; handler logic stays the same.

### 3. Wire spec + Scalar UI in `initHttp` (`server/src/pkg/http/index.ts`)

- Register the Bearer security scheme:
  `app.openAPIRegistry.registerComponent("securitySchemes", "Bearer", { type: "http", scheme: "bearer", bearerFormat: "JWT" })`
- Serve spec at `/doc`:
  `app.doc("/doc", { openapi, info: { title: "Expensif API", version: "v1" }, servers: [{ url: "/api/v1" }] })`
- Mount UI at `/docs`:
  `app.get("/docs", scalar({ url: "/doc" }))`

### 4. Verify

- `pnpm lint`
- `pnpm run format:check`
- Run `pnpm dev` and confirm Scalar UI loads at `http://localhost:<PORT>/docs`.
