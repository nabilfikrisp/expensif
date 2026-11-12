import type { OpenAPIHono } from "@hono/zod-openapi";
import { expect, it } from "vitest";
import { AuthError } from "@/modules/auth/error";
import { API_PREFIX } from "@/pkg/http";

export function testBearerAuthentication(getApp: () => OpenAPIHono, method: string, path: string) {
  it.each([
    [undefined, AuthError.missingBearerHeader()],
    ["Bearer invalid-token-value", AuthError.failedVerifyingJwt()],
  ] as const)("rejects unauthorized access (%s)", async (authorization, error) => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (authorization) {
      headers.Authorization = authorization;
    }
    const response = await getApp().request(`${API_PREFIX}${path}`, {
      method,
      headers,
      ...(method === "POST" ? { body: "{}" } : {}),
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      success: false,
      error: error.code,
      message: error.message,
    });
  });
}
