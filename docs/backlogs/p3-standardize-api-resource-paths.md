# Standardize API resource paths and key revocation

Problem: Resource paths use singular collection names, current-user operations are split between authentication and user paths, and a bodyless PATCH implicitly revokes an API key. Adopt plural resource paths and an explicit revocation action while retaining existing authentication action names.

Evidence: The [composition root](../../server/src/app.ts) registers `user`, `api-key`, and `linked-account` prefixes. [Current-user retrieval](../../server/src/modules/auth/controllers/http/me.ts) is under authentication, while [deletion](../../server/src/modules/user/controllers/http/delete.ts) is under users. The [revocation controller](../../server/src/modules/api-key/controllers/http/revoke.ts) accepts PATCH without an update body. Existing endpoints are listed in the [server README](../../server/README.md#http-api).

Done when:

- Resource routes follow this mapping, relative to the unchanged `/api/v1` prefix:

  | Current | Replacement |
  | --- | --- |
  | `GET /auth/me` | `GET /users/me` |
  | `DELETE /user/me` | `DELETE /users/me` |
  | `POST /api-key` | `POST /api-keys` |
  | `GET /api-key` | `GET /api-keys` |
  | `PATCH /api-key/{id}` | `POST /api-keys/{id}/revoke` |
  | `DELETE /api-key/{id}` | `DELETE /api-keys/{id}` |
  | `GET /linked-account` | `GET /linked-accounts` |
  | `DELETE /linked-account/{id}` | `DELETE /linked-accounts/{id}` |

- Authentication actions remain `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/logout-all`, and `/auth/change-password`; CSRF retrieval remains `GET /auth/csrf`. Documentation endpoints remain unchanged.
- Revocation remains distinct from deletion. Apart from the agreed paths and revocation method, request/response contracts, status codes, ownership checks, authentication, CSRF protections, rate limits, and transaction behavior remain unchanged.
- Route registration, OpenAPI contracts and descriptions, HTTP tests, shared test helpers, standalone checks, the Postman collection, and affected README route entries use the agreed paths and methods. Preserve the existing controller/service/use-case dependency rules when relocating current-user retrieval.
- Check affected consumers before rollout and obtain a maintainer decision on a coordinated breaking change or temporary compatibility routes. Do not silently introduce redirects or aliases for mutation endpoints.
- Relevant HTTP behavioral tests verify the new paths and methods, cross-user protections, and the selected compatibility behavior. Run database-backed tests only through the dedicated test-database runner; relevant checks and `pnpm --dir server lintformat` pass.

Scope: API URL and revocation-method consistency only. No new PUT or PATCH operations, profile or expense editing, response redesign, authentication workflow changes, service/query refactors, or database migrations.
