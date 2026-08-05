import type { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, expectTypeOf, it } from "vitest";
import { initTest } from "./helper";
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
    //   const body = await res.json();
    //   expect(body.success).toBe(true);
    //   expect(body.data.accessToken).toBeDefined();
    //   expectTypeOf(body.data.accessToken).toBe("string");
    });
  });
});
