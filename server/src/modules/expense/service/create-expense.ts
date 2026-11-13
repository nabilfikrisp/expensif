import { z } from "zod";
import { expenses } from "../schema";
import { createExpenseInputSchema } from "./dto";
import type { CreateExpenseInput, CreateExpenseOutput } from "./dto";
import type { Tx } from "@/pkg/db";

export function initCreateExpense() {
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

  return async function createExpense(
    input: CreateExpenseInput,
    transaction: Tx
  ): Promise<CreateExpenseOutput> {
    const validatedExpense = parseExpenseForStorage(input);
    const [createdExpense] = await transaction
      .insert(expenses)
      .values({ ...validatedExpense, id: crypto.randomUUID() })
      .returning();

    return createdExpense;
  };
}
