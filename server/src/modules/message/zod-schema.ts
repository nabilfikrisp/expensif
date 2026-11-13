import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod";
import type { z } from "zod";
import { messages } from "./schema";

export const messageSelectSchema = createSelectSchema(messages);

export const createMessageInputSchema = createInsertSchema(messages).omit({
  id: true,
  receivedAt: true,
});

export const createMessageOutputSchema = messageSelectSchema;

export type CreateMessageInput = z.infer<typeof createMessageInputSchema>;
export type CreateMessageOutput = z.infer<typeof createMessageOutputSchema>;
