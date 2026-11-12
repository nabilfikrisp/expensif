import { Context } from "hono";
import { errors as joseErrors } from "jose";
import { beforeEach, describe, expect, it } from "vitest";

import { initAuthMiddleware } from "@/modules/auth/controllers/middleware";

let context: Context<{ Variables: { userId: string } }, string>;

beforeEach(() => {
  context = new Context(
    new Request("http://localhost/protected", {
      headers: { Authorization: "Bearer test-token" },
    })
  );
});

// Injected verifier and downstream failures preserve error identity, which HTTP responses cannot expose.
describe("AuthMiddleware", () => {
  it.each([new Error("unexpected verifier failure"), new joseErrors.JOSENotSupported()])(
    "rethrows the original unexpected verification error: %s",
    async (error) => {
      const middleware = initAuthMiddleware(() => Promise.reject(error));

      await expect(middleware(context, async () => {})).rejects.toBe(error);
    }
  );

  it("preserves downstream errors after successful verification", async () => {
    const error = new Error("downstream failure");
    const middleware = initAuthMiddleware(() => Promise.resolve({ sub: "user-id" }));

    await expect(middleware(context, () => Promise.reject(error))).rejects.toBe(error);
  });
});
