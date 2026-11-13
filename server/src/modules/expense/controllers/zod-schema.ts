import { z } from "zod";

export const ingestExpenseReqSchema = z.object({
  platform: z.string().min(1),
  platformUserId: z.string().min(1),
  rawText: z.string().min(1),
  parsingInput: z.string().min(1),
  externalConversationId: z.string().nullable().optional(),
  externalMessageId: z.string().nullable().optional(),
  // The controller constructs this key from trusted transport metadata.
  idempotencyKey: z.string().min(1),
});

export const ingestExpenseRespSchema = z.object({
  messageId: z.string(),
  parseStatus: z.literal("parsed"),
  // Several items with one combined total remain one expense.
  expense: z.object({
    id: z.string(),
    itemName: z.string().min(1),
    amount: z.string().regex(/^[1-9][0-9]*(?![\s\S])/),
    currency: z.literal("IDR"),
    expenseDate: z.iso.date(),
    categoryId: z.string().nullable(),
    categorySlug: z.string().nullable(),
    note: z.string().nullable(),
  }),
});

export type IngestExpenseReq = z.infer<typeof ingestExpenseReqSchema>;
export type IngestExpenseResp = z.infer<typeof ingestExpenseRespSchema>;
