import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { initUseCaseTest } from "../helper";

let ctx: Awaited<ReturnType<typeof initUseCaseTest>>;
let userId: string;

const mockUser = { email: "test@example.com", password: "pass123", name: "Test User" };

beforeEach(async () => {
  ctx = await initUseCaseTest();

  await ctx.services.auth.register(mockUser.email, mockUser.password, mockUser.name);

  const user = await ctx.services.user.getUserByEmail(mockUser.email);
  userId = user.id;
});

afterEach(() => {
  ctx.cleanup();
});

describe("LinkedAccountUseCase.redeemApiKey", () => {
  it("redeems a valid key and returns the owner's name and email", async () => {
    const { key: token } = await ctx.services.apiKey.generateApiKey(userId, "telegram");

    const result = await ctx.useCases.linkedAccount.redeemApiKey({
      token,
      platform: "telegram",
      platformUserId: "tg-123",
      platformUsername: "tester",
    });

    expect(result).toEqual({ userName: mockUser.name, userEmail: mockUser.email });
  });
});
