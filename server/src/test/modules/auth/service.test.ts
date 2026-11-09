import { SignJWT, errors as joseErrors } from "jose";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { initTest } from "../../helper";

import { AuthError } from "@/modules/auth/error";

let ctx: Awaited<ReturnType<typeof initTest>>;

beforeAll(async () => {
  ctx = await initTest();
  return () => ctx.client.end();
});

afterEach(() => vi.restoreAllMocks());

describe("AuthService.refresh", () => {
  it.each([
    ["expired", { exp: 0 }],
    ["not yet valid", { nbf: 4102444800 }],
    ["missing subject", { sub: undefined }],
    ["wrong token type", { type: "access" }],
  ])("rejects a token that is %s", async (_description, claims) => {
    const secret = ctx.services.auth.encodeSecret(ctx.env.JWT_SECRET, "refresh");
    const token = await new SignJWT({ sub: "user-id", type: "refresh", ...claims })
      .setProtectedHeader({ alg: "HS256" })
      .sign(secret);

    await expect(ctx.services.auth.refresh(token)).rejects.toMatchObject({
      code: AuthError.invalidToken().code,
    });
  });

  it("rejects malformed tokens, invalid signatures, and disallowed algorithms", async () => {
    const { auth } = ctx.services;
    const secret = auth.encodeSecret(ctx.env.JWT_SECRET, "refresh");
    const wrongSecret = auth.encodeSecret(ctx.env.JWT_SECRET);
    const tokens = [
      "invalid-token-value",
      await new SignJWT({ sub: "user-id", type: "refresh" })
        .setProtectedHeader({ alg: "HS256" })
        .sign(wrongSecret),
      await new SignJWT({ sub: "user-id", type: "refresh" })
        .setProtectedHeader({ alg: "HS384" })
        .sign(secret),
    ];

    for (const token of tokens) {
      await expect(auth.refresh(token)).rejects.toMatchObject({
        code: AuthError.invalidToken().code,
      });
    }
  });

  it.each([new Error("unexpected verifier failure"), new joseErrors.JOSENotSupported()])(
    "rethrows the original unexpected verification error: %s",
    async (error) => {
      vi.spyOn(ctx.services.auth, "verifyToken").mockRejectedValue(error);

      await expect(ctx.services.auth.refresh("any-value")).rejects.toBe(error);
    }
  );
});
