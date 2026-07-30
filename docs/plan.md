# Auth Service — Login / Register with JWT Access + Refresh Tokens

## Overview

Stateless auth using two JWTs (access + refresh). Refresh token delivered via HTTP-only cookie.

## Current file structure

```
src/modules/auth/
  service.ts               — initAuthService() with pure helpers (done)
  controllers/
    middleware.ts            — authMiddleware(secret, authService) (done)
    http.ts                 — initAuthRoutes stub, zod schemas (incomplete)
```

## Status

| step | status |
|---|---|
| Install deps (`bcryptjs`, `jose`) | ✅ done |
| Env vars in `src/pkg/env/index.ts` | ✅ done |
| Env vars in `.env.example` | ✅ done |
| `service.ts` — encodeSecret, hash, verify, signToken, verifyToken | ✅ done |
| `service.ts` — register / login / refresh / getUser (DB methods) | ❌ not done |
| `controllers/middleware.ts` — authMiddleware | ✅ done |
| `controllers/http.ts` — route handlers | ⬜ stub only (`initAuthRoutes` declared, empty body) |
| Wire up in `src/pkg/http/index.ts` | ❌ not done |
| Validate | ❌ not done |

## Architecture: Service → Controllers → HTTP

### `service.ts` — business logic + DB access

`initAuthService(env: EnvSchema, db: Db)` returns:

| method | logic |
|---|---|
| `register(email, password, name)` | Check duplicate → hash pw → insert user → sign access + refresh tokens → `{ accessToken, refreshToken }` |
| `login(email, password)` | Find user → verify pw → sign tokens → `{ accessToken, refreshToken }` |
| `refresh(token)` | `verifyToken(token, REFRESH_SECRET)` → check `type === "refresh"` → sign new tokens → `{ accessToken, refreshToken }` |
| `getUser(userId)` | Query user by id → `{ id, email, name }` |

### `controllers/http.ts` — thin HTTP layer (no DB, no logic)

`initAuthRoutes(env: EnvSchema, authService: AuthService): Hono`

| route | handler |
|---|---|
| `POST /auth/register` | Parse body → `authService.register(...)` → set refresh cookie → `{ accessToken }` |
| `POST /auth/login` | Parse body → `authService.login(...)` → set refresh cookie → `{ accessToken }` |
| `POST /auth/refresh` | Read cookie → `authService.refresh(token)` → set refresh cookie → `{ accessToken }` |
| `POST /auth/logout` | Clear cookie → `{ message }` |
| `GET /auth/me` | `authMiddleware` → `authService.getUser(userId)` → `{ id, email, name }` |

### `http/index.ts` — wiring

```ts
const authService = initAuthService(env, db)
app.route("/auth", initAuthRoutes(env, authService))
```

## Remaining work (in order)

1. Add `register`, `login`, `refresh`, `getUser` methods to `src/modules/auth/service.ts`
2. Complete `src/modules/auth/controllers/http.ts` — route handlers calling the service
3. Wire up in `src/pkg/http/index.ts`
4. Validate with curl
