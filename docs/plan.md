# Plan: Refresh Token Rotation

## Overview

Implement refresh token rotation so that every time a refresh token is used, a new one is issued. This limits the window of token reuse if a refresh token is compromised.

## Current Behavior

- `refresh()` returns only `{ accessToken }` — refresh token is never rotated
- The old refresh token remains valid until expiry even after being used

## Target Behavior

On refresh:
1. Issue a new refresh token (rotation)
2. Set it as a new HTTP-only cookie
3. Return the new access token in the response body (refresh token stays cookie-only)

## Steps

### 1. Uncomment rotation code in `server/src/modules/auth/service.ts`

**File:** `server/src/modules/auth/service.ts`
**Lines:** 78-107 (`refresh()` method)

- Uncomment lines 101-105 (the new refresh token signing)
- Change the return value from `{ accessToken }` to `{ accessToken, refreshToken }`

**Before:**
```ts
async refresh(token: string) {
  // ... validation ...

  const accessToken = await signToken(
    { sub: userId },
    accessSecret,
    env.ACCESS_TOKEN_EXPIRES_IN_MINUTES
  );
  //   const newRefreshToken = await signToken(
  //     { sub: userId, type: "refresh" },
  //     refreshSecret,
  //     env.REFRESH_TOKEN_EXPIRES_IN_DAYS
  //   );

  return { accessToken };
},
```

**After:**
```ts
async refresh(token: string) {
  // ... validation ...

  const accessToken = await signToken(
    { sub: userId },
    accessSecret,
    env.ACCESS_TOKEN_EXPIRES_IN_MINUTES
  );
  const refreshToken = await signToken(
    { sub: userId, type: "refresh" },
    refreshSecret,
    env.REFRESH_TOKEN_EXPIRES_IN_DAYS
  );

  return { accessToken, refreshToken };
},
```

### 2. Set new cookie on refresh in `server/src/modules/auth/controllers/http.ts`

**File:** `server/src/modules/auth/controllers/http.ts`
**Lines:** 168-182 (refresh handler)

- Add `setRefreshCookie(c, result.refreshToken)` after `authService.refresh(token)`
- Response body stays the same (only `accessToken`) — refresh token is HTTP-only cookie

**Before:**
```ts
app.openapi(refreshRoute, async (c) => {
  const token = getRefreshCookie(c);
  if (!token) {
    throw AuthError.invalidToken();
  }
  const result = await authService.refresh(token);
  return c.json(
    {
      success: true,
      message: "success",
      data: { accessToken: result.accessToken },
    },
    200
  );
});
```

**After:**
```ts
app.openapi(refreshRoute, async (c) => {
  const token = getRefreshCookie(c);
  if (!token) {
    throw AuthError.invalidToken();
  }
  const result = await authService.refresh(token);
  setRefreshCookie(c, result.refreshToken);
  return c.json(
    {
      success: true,
      message: "success",
      data: { accessToken: result.accessToken },
    },
    200
  );
});
```

## Security Notes

- **Stateless rotation:** Old refresh token remains valid until expiry. This limits but doesn't eliminate token reuse.
- **Cookie-only exposure:** New refresh token is never in the response body, only set as HTTP-only cookie.
- **Future enhancement:** For full old-token invalidation, a token store (blacklist/rotation table) would be needed.

## Files Changed

| File | Change |
|---|---|
| `server/src/modules/auth/service.ts` | Uncomment rotation code, return both tokens |
| `server/src/modules/auth/controllers/http.ts` | Set new refresh cookie on refresh |

## Verification

1. Register a new user → get access + refresh tokens
2. Use refresh token to call `POST /api/v1/auth/refresh`
3. Verify: new access token returned in response body
4. Verify: new `refresh_token` cookie is set in response headers
5. Verify: old refresh token still works until expiry (stateless)
6. Run `pnpm lint` and `pnpm run format:check`
