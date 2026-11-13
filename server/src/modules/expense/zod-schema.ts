import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod";
import { z } from "zod";
import { expenses } from "./schema";

export const expenseSelectSchema = createSelectSchema(expenses);

export const createExpenseInputSchema = createInsertSchema(expenses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const createExpenseOutputSchema = expenseSelectSchema;
export const findExpenseOutputSchema = expenseSelectSchema.extend({
  categorySlug: z.string().nullable(),
});

export const parseExpenseOutputSchema = z.object({
  itemName: z.string().min(1),
  amount: z.string().regex(/^[1-9][0-9]*(?![\s\S])/),
  currency: z.literal("IDR"),
  expenseDate: z.iso.date(),
  categoryId: z.string(),
  categorySlug: z.string().min(1),
  note: z.string().nullable(),
});

export interface ParseExpenseInput {
  text: string;
}

export type ParseExpenseOutput = z.infer<typeof parseExpenseOutputSchema>;
export type FindExpenseOutput = z.infer<typeof findExpenseOutputSchema>;

export type CreateExpenseInput = z.infer<typeof createExpenseInputSchema>;
export type CreateExpenseOutput = z.infer<typeof createExpenseOutputSchema>;
