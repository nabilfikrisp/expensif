import { Context } from "hono";
import { errors as joseErrors } from "jose";
import { beforeEach, describe, expect, it } from "vitest";

import { initAuthMiddleware } from "@/modules/auth/controllers/middleware";
import { AuthError } from "@/modules/auth/error";

let context: Context<{ Variables: { userId: string } }, string>;

beforeEach(() => {
  context = new Context(
    new Request("http://localhost/protected", {
      headers: { Authorization: "Bearer test-token" },
    })
  );
});

describe("AuthMiddleware", () => {
  it("rejects a verified payload without a subject", async () => {
    const middleware = initAuthMiddleware(() => Promise.resolve({}));

    await expect(middleware(context, async () => {})).rejects.toMatchObject({
      code: AuthError.invalidJwtPayload().code,
    });
  });

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
