import { and, eq, getTableColumns } from "drizzle-orm";
import { z } from "zod";

import { execParseExpense } from "./parser";
import { expenses } from "./schema";
import { createExpenseInputSchema, parseExpenseOutputSchema } from "./zod-schema";
import type {
  CreateExpenseInput,
  CreateExpenseOutput,
  FindExpenseOutput,
  ParseExpenseInput,
  ParseExpenseOutput,
} from "./zod-schema";
import { categories } from "@/modules/category/schema";
import type { CategoryService } from "@/modules/category/service";
import type { Db, DbTx, Tx } from "@/pkg/db";
import type { Llm } from "@/pkg/llm";

export function initExpenseService(llm: Llm, db: Db, categoryService: CategoryService) {
  return {
    async createExpense(input: CreateExpenseInput, transaction: Tx): Promise<CreateExpenseOutput> {
      const validatedExpense = parseExpenseForStorage(input);
      const [createdExpense] = await transaction
        .insert(expenses)
        .values({ ...validatedExpense, id: crypto.randomUUID() })
        .returning();

      return createdExpense;
    },

    async findExpenseByMessageId(
      userId: string,
      messageId: string,
      ctx: DbTx = db
    ): Promise<FindExpenseOutput | undefined> {
      const belongsToUser = eq(expenses.userId, userId);
      const comesFromMessage = eq(expenses.messageId, messageId);
      const matchingExpenses = await ctx
        .select({ ...getTableColumns(expenses), categorySlug: categories.slug })
        .from(expenses)
        .leftJoin(categories, eq(expenses.categoryId, categories.id))
        .where(and(belongsToUser, comesFromMessage))
        .limit(1);

      return matchingExpenses.at(0);
    },

    async parseExpense({ text }: ParseExpenseInput): Promise<ParseExpenseOutput> {
      const availableCategories = await categoryService.listCategories();
      const parsedExpense = await execParseExpense(llm, text, availableCategories);
      const resolvedCategory = await categoryService.resolveCategory(parsedExpense.category);

      return parseExpenseOutputSchema.parse({
        itemName: parsedExpense.item_name,
        amount: parsedExpense.amount,
        currency: parsedExpense.currency,
        expenseDate: parsedExpense.date,
        categoryId: resolvedCategory.id,
        categorySlug: resolvedCategory.slug,
        note: parsedExpense.note ?? null,
      });
    },
  };
}

function parseExpenseForStorage(input: CreateExpenseInput): CreateExpenseInput {
  const validatedExpense = createExpenseInputSchema.parse(input);
  const positiveWholeAmountSchema = z.string().regex(/^[1-9][0-9]*(?![\s\S])/);
  const idrCurrencySchema = z.literal("IDR");
  const calendarDateSchema = z.iso.date();

  // Reject values PostgreSQL could round or normalize; keep amounts as exact strings.
  // The regex requires the absolute end of input, including rejection of trailing newlines.
  positiveWholeAmountSchema.parse(validatedExpense.amount);
  idrCurrencySchema.parse(validatedExpense.currency ?? "IDR");
  calendarDateSchema.parse(validatedExpense.expenseDate);

  return validatedExpense;
}

export type ExpensesService = ReturnType<typeof initExpenseService>;
