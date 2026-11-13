import { z } from "zod";

export const findMessageByIdempotencyKeyInputSchema = z.object({ idempotencyKey: z.string() });
export type FindMessageByIdempotencyKeyInput = z.infer<
  typeof findMessageByIdempotencyKeyInputSchema
>;
export const findMessageByIdempotencyKeyOutputSchema = z
  .object({
    id: z.string(),
    userId: z.uuid(),
    linkedAccountId: z.string().nullable(),
    rawText: z.string(),
    platform: z.string(),
    externalConversationId: z.string().nullable(),
    externalMessageId: z.string().nullable(),
    idempotencyKey: z.string(),
    parseStatus: z.string(),
    receivedAt: z.string(),
  })
  .optional();
export type FindMessageByIdempotencyKeyOutput = z.infer<
  typeof findMessageByIdempotencyKeyOutputSchema
>;

export const createMessageInputSchema = z.object({
  userId: z.uuid(),
  linkedAccountId: z.string().nullable().optional(),
  rawText: z.string(),
  platform: z.string(),
  externalConversationId: z.string().nullable().optional(),
  externalMessageId: z.string().nullable().optional(),
  idempotencyKey: z.string(),
  parseStatus: z.string(),
});
export type CreateMessageInput = z.infer<typeof createMessageInputSchema>;
export const createMessageOutputSchema = z.object({
  id: z.string(),
  userId: z.uuid(),
  linkedAccountId: z.string().nullable(),
  rawText: z.string(),
  platform: z.string(),
  externalConversationId: z.string().nullable(),
  externalMessageId: z.string().nullable(),
  idempotencyKey: z.string(),
  parseStatus: z.string(),
  receivedAt: z.string(),
});
export type CreateMessageOutput = z.infer<typeof createMessageOutputSchema>;
