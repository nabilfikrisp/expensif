import type { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it } from "vitest";

import { initTest } from "./helper";

import { registerRespSchema } from "@/modules/auth/controllers/http/register";
import { API_PREFIX } from "@/pkg/http";
import { errorRespSchema } from "@/shared/response.schema";

let app: OpenAPIHono;

beforeEach(async () => {
  const testCtx = await initTest();
  app = testCtx.app;
});

describe("Auth Endpoints", () => {
  const user = { email: "test@example.com", password: "pass123", name: "Test User" };

  describe(`POST ${API_PREFIX}/auth/register`, () => {
    it("returns 201 with accessToken", async () => {
      const res = await app.request(`${API_PREFIX}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user),
      });

      expect(res.status).toBe(201);
      const respBody: unknown = await res.json();
      const parseResult = registerRespSchema.safeParse(respBody);

      expect(parseResult.success).toBe(true);
      if (parseResult.success) {
        const response = parseResult.data;
        expect(response.data.accessToken).toBeTypeOf("string");
      }
    });

    it("sets refresh_token http only cookie", async () => {
      const res = await app.request(`${API_PREFIX}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user),
      });

      expect(res.status).toBe(201);

      const cookies = res.headers.getSetCookie();
      const refreshCookie = cookies.find((c) => c.startsWith("refresh_token="));

      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain("HttpOnly");
      expect(refreshCookie).toContain("Path=/api/v1/auth");
    });

    it("returns 409 when email already exists", async () => {
      await app.request(`${API_PREFIX}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user),
      });

      const res = await app.request(`${API_PREFIX}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user),
      });

      expect(res.status).toBe(409);
      const respBody: unknown = await res.json();
      const parseResult = errorRespSchema.safeParse(respBody);

      expect(parseResult.success).toBe(true);
      if (parseResult.success) {
        const response = parseResult.data;
        expect(response.success).toBe(false);
        expect(response.error).toBe("Email already registered");
      }
    });
  });
});
