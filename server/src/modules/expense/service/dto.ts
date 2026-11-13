import { z } from "zod";

export const createExpenseInputSchema = z.object({
  messageId: z.string().nullable().optional(),
  userId: z.uuid(),
  categoryId: z.string().nullable().optional(),
  itemName: z.string(),
  amount: z.string(),
  currency: z.string().optional(),
  expenseDate: z.string(),
  note: z.string().nullable().optional(),
});
export type CreateExpenseInput = z.infer<typeof createExpenseInputSchema>;
export const createExpenseOutputSchema = z.object({
  id: z.string(),
  messageId: z.string().nullable(),
  userId: z.uuid(),
  categoryId: z.string().nullable(),
  itemName: z.string(),
  amount: z.string(),
  currency: z.string(),
  expenseDate: z.string(),
  note: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CreateExpenseOutput = z.infer<typeof createExpenseOutputSchema>;

export const findExpenseByMessageIdInputSchema = z.object({
  userId: z.string(),
  messageId: z.string(),
});
export type FindExpenseByMessageIdInput = z.infer<typeof findExpenseByMessageIdInputSchema>;
export const findExpenseByMessageIdOutputSchema = z.object({
  id: z.string(),
  messageId: z.string().nullable(),
  userId: z.uuid(),
  categoryId: z.string().nullable(),
  itemName: z.string(),
  amount: z.string(),
  currency: z.string(),
  expenseDate: z.string(),
  note: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  categorySlug: z.string().nullable(),
});
export type FindExpenseByMessageIdOutput = z.infer<typeof findExpenseByMessageIdOutputSchema>;

export const parseExpenseInputSchema = z.object({ text: z.string() });
export type ParseExpenseInput = z.infer<typeof parseExpenseInputSchema>;
export const parseExpenseOutputSchema = z.object({
  itemName: z.string().min(1),
  amount: z.string().regex(/^[1-9][0-9]*(?![\s\S])/),
  currency: z.literal("IDR"),
  expenseDate: z.iso.date(),
  categoryId: z.string(),
  categorySlug: z.string().min(1),
  note: z.string().nullable(),
});
export type ParseExpenseOutput = z.infer<typeof parseExpenseOutputSchema>;

export type FindExpenseOutput = FindExpenseByMessageIdOutput;
