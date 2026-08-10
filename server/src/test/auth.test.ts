import type { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it } from "vitest";

import { initTest } from "./helper";

import { registerRespSchema } from "@/modules/auth/controllers/http/register";
import { API_PREFIX } from "@/pkg/http";

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
      const result = registerRespSchema.safeParse(respBody);

      expect(result.success).toBe(true);
      if (result.success) {
        const response = result.data;
        expect(response.data.accessToken).toBeTypeOf("string");
      }
    });
  });
});
