import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { initCategoryService } from "@/modules/category/service";
import { expenses } from "@/modules/expense/schema";
import { initExpenseService } from "@/modules/expense/service";
import { initExpenseUseCase } from "@/modules/expense/use-case";
import type { IngestExpenseInput } from "@/modules/expense/use-case/dto";
import type { ExpenseUseCase } from "@/modules/expense/use-case/interface";
import { initLinkedAccountService } from "@/modules/linked-account/service";
import { messages } from "@/modules/message/schema";
import { initMessageService } from "@/modules/message/service";
import { users } from "@/modules/user/schema";
import { initTestDb } from "@/test/helper/database";
import { expenseModel } from "@/test/helper/expense-model";

let ctx: Awaited<ReturnType<typeof initTestDb>>;
let useCase: ExpenseUseCase;
const userId = crypto.randomUUID();
const modelResponse = vi.fn<() => Promise<unknown>>();
const request: IngestExpenseInput = {
  platform: "telegram",
  platformUserId: "123",
  rawText: "bakso 15k",
  parsingInput: "bakso 15k",
  idempotencyKey: "telegram:expense:chat:42",
};

beforeAll(async () => {
  ctx = await initTestDb();
  return () => ctx.client.end();
});

beforeEach(async () => {
  await ctx.resetDb();
  await ctx.db.insert(users).values({
    id: userId,
    name: "Owner",
    email: "owner@example.com",
    passwordHash: "unused",
  });
  const categoryService = initCategoryService({ db: ctx.db });
  await categoryService.seedCategories();
  const linkedAccountService = initLinkedAccountService({ db: ctx.db });
  for (const platform of ["telegram", "discord"]) {
    await linkedAccountService.linkAccount({ userId, platform, platformUserId: "123" });
  }
  useCase = initExpenseUseCase({
    db: ctx.db,
    linkedAccountService,
    messageService: initMessageService({ db: ctx.db }),
    expenseService: initExpenseService({
      llm: { model: expenseModel(modelResponse) },
      db: ctx.db,
      categoryService,
    }),
  });
  modelResponse.mockReset().mockResolvedValue({
    item_name: "bakso",
    amount: "15000",
    currency: "IDR",
    date: "2026-11-09",
    category: "food",
  });
});

afterEach(() => vi.restoreAllMocks());

// Telegram always supplies source IDs and its own namespace. The use case is the
// highest entry point for other adapters and optional metadata.
describe("ingestion source identity", () => {
  it("saves absent metadata and returns the same result for an explicit-null retry", async () => {
    const saved = await useCase.ingestExpense(request);
    expect(
      await useCase.ingestExpense({
        ...request,
        externalConversationId: null,
        externalMessageId: null,
      })
    ).toEqual(saved);
    expect(await ctx.db.select().from(messages)).toEqual([
      expect.objectContaining({
        id: saved.messageId,
        userId,
        externalConversationId: null,
        externalMessageId: null,
      }),
    ]);
    expect(await ctx.db.select().from(expenses)).toEqual([
      expect.objectContaining({ id: saved.expense.id, messageId: saved.messageId, userId }),
    ]);
    expect(modelResponse).toHaveBeenCalledOnce();
  });

  it("keeps matching source IDs separate across platform namespaces", async () => {
    const results = [];
    for (const platform of ["telegram", "discord"]) {
      const input = {
        ...request,
        platform,
        idempotencyKey: `${platform}:expense:chat:42`,
        externalConversationId: "chat",
        externalMessageId: "42",
      };
      const saved = await useCase.ingestExpense(input);
      results.push(saved);
    }
    expect(new Set(results.map((result) => result.expense.id)).size).toBe(2);
    expect(await ctx.db.select().from(messages)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ platform: "telegram", idempotencyKey: request.idempotencyKey }),
        expect.objectContaining({ platform: "discord", idempotencyKey: "discord:expense:chat:42" }),
      ])
    );
    expect(await ctx.db.select().from(messages)).toHaveLength(2);
    expect(await ctx.db.select().from(expenses)).toHaveLength(2);
    expect(modelResponse).toHaveBeenCalledTimes(2);
  });

  it("uses opaque keys independently of source metadata", async () => {
    const input = { ...request, externalConversationId: "chat", externalMessageId: "42" };
    const first = await useCase.ingestExpense(input);
    const second = await useCase.ingestExpense({ ...input, idempotencyKey: "adapter:second" });
    expect(second.messageId).not.toBe(first.messageId);
    expect(
      await useCase.ingestExpense({
        ...input,
        externalConversationId: null,
        externalMessageId: null,
      })
    ).toEqual(first);
    const rows = await ctx.db.select().from(messages);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row).toMatchObject({ externalConversationId: "chat", externalMessageId: "42" });
    }
    expect(await ctx.db.select().from(expenses)).toHaveLength(2);
    expect(modelResponse).toHaveBeenCalledTimes(2);
  });

  it("rejects a key from another platform even when both accounts share an owner", async () => {
    await useCase.ingestExpense(request);
    const savedMessages = await ctx.db.select().from(messages);
    const savedExpenses = await ctx.db.select().from(expenses);
    await expect(useCase.ingestExpense({ ...request, platform: "discord" })).rejects.toMatchObject({
      code: "EXPENSE_IDEMPOTENCY_CONFLICT",
    });
    expect(await ctx.db.select().from(messages)).toEqual(savedMessages);
    expect(await ctx.db.select().from(expenses)).toEqual(savedExpenses);
    expect(modelResponse).toHaveBeenCalledOnce();
  });
});
