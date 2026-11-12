import type { OpenAPIHono } from "@hono/zod-openapi";
import type { TestContext } from "./app";
import { users } from "@/pkg/db/schema";
import { API_PREFIX } from "@/pkg/http";
import { tokenRespSchema } from "@/shared/response.schema";

export const mockUser = { email: "test@example.com", password: "pass1234", name: "Test User" };

// Valid cost-12 hash for mockUser.password; fixtures avoid repeating registration's bcrypt work.
const TEST_USER_BCRYPT_HASH = "$2b$12$u/hkfq2HuTY0cHc2i09ML.wzooTupgp7Is.394iAhSqemiuHd49Cu";

type TestUserIdentity = Pick<typeof mockUser, "email" | "name">;

interface SessionTokens {
  refreshToken: string;
  csrfToken: string;
}

// Seed identity when registration is setup; representative flows still register through HTTP.
export async function seedUser(context: TestContext, user: TestUserIdentity = mockUser) {
  const userId = crypto.randomUUID();
  await context.db.insert(users).values({
    id: userId,
    email: user.email,
    name: user.name,
    passwordHash: TEST_USER_BCRYPT_HASH,
  });
  return { userId, accessToken: await context.services.auth.issueAccessToken(userId) };
}

// Seed an existing session without repeating registration or password hashing.
export async function seedSession(context: TestContext) {
  const user = await seedUser(context);
  const { refreshToken } = await context.services.session.createSession(user.userId);
  return { ...user, refreshToken, csrfToken: crypto.randomUUID() };
}

export async function registerAndGetToken(
  app: OpenAPIHono,
  user: { email: string; password: string; name: string }
) {
  const response = await app.request(`${API_PREFIX}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  });

  if (response.status !== 201) {
    throw new Error(`Registration failed: ${response.status}`);
  }
  return readAuthenticationTokens(response);
}

export async function loginAndGetTokens(app: OpenAPIHono, email: string, password: string) {
  const response = await app.request(`${API_PREFIX}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (response.status !== 200) {
    throw new Error(`Login failed: ${response.status}`);
  }
  return readAuthenticationTokens(response);
}

export function refreshSession(app: OpenAPIHono, tokens: SessionTokens) {
  return app.request(`${API_PREFIX}/auth/refresh`, {
    method: "POST",
    headers: sessionHeaders(tokens),
  });
}

export function sessionHeaders(tokens: SessionTokens) {
  return {
    Cookie: `refresh_token=${tokens.refreshToken}; csrf_token=${tokens.csrfToken}`,
    "X-CSRF-Token": tokens.csrfToken,
  };
}

export function sessionCookies(response: Response) {
  function readLiveCookie(name: string) {
    const cookie = response.headers.getSetCookie().find((item) => item.startsWith(`${name}=`));
    if (!cookie || cookie.includes("Max-Age=0")) {
      throw new Error(`Expected live ${name} cookie`);
    }
    return cookie.split(";")[0].slice(name.length + 1);
  }
  return { refreshToken: readLiveCookie("refresh_token"), csrfToken: readLiveCookie("csrf_token") };
}

async function readAuthenticationTokens(response: Response) {
  const { data } = tokenRespSchema.parse(await response.json());
  return { accessToken: data.accessToken, ...sessionCookies(response) };
}
