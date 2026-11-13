import { z } from "zod";

export const ingestExpenseInputSchema = z.object({
  platform: z.string().min(1),
  platformUserId: z.string().min(1),
  rawText: z.string().min(1),
  parsingInput: z.string().min(1),
  externalConversationId: z.string().nullable().optional(),
  externalMessageId: z.string().nullable().optional(),
  // Opaque to the use case; source metadata does not determine retry identity.
  idempotencyKey: z.string().min(1),
});

export const ingestExpenseOutputSchema = z.object({
  messageId: z.string(),
  parseStatus: z.literal("parsed"),
  expense: z.object({
    id: z.string(),
    // Keep a combined description and total; never invent per-item prices.
    itemName: z.string().min(1),
    amount: z.string().regex(/^[1-9][0-9]*(?![\s\S])/),
    currency: z.literal("IDR"),
    expenseDate: z.iso.date(),
    categoryId: z.string().nullable(),
    categorySlug: z.string().nullable(),
    note: z.string().nullable(),
  }),
});

export type IngestExpenseInput = z.infer<typeof ingestExpenseInputSchema>;
export type IngestExpenseOutput = z.infer<typeof ingestExpenseOutputSchema>;
