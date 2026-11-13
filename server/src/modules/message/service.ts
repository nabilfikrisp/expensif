import { eq } from "drizzle-orm";

import { MessageError } from "./error";
import { messages } from "./schema";
import { createMessageInputSchema } from "./zod-schema";
import type { CreateMessageInput, CreateMessageOutput } from "./zod-schema";
import type { Db, DbTx, Tx } from "@/pkg/db";
import { isUniqueConstraintError } from "@/pkg/db/error";

export function initMessageService(db: Db) {
  return {
    async findMessageByIdempotencyKey(idempotencyKey: string, database: DbTx = db) {
      // The ingestion use case must verify the returned owner before exposing a retry result.
      const matchingMessages = await database
        .select()
        .from(messages)
        .where(eq(messages.idempotencyKey, idempotencyKey))
        .limit(1);

      return matchingMessages.at(0);
    },

    async createMessage(input: CreateMessageInput, tx: Tx): Promise<CreateMessageOutput> {
      const validatedMessage = createMessageInputSchema.parse(input);
      try {
        const [createdMessage] = await tx
          .insert(messages)
          .values({ ...validatedMessage, id: crypto.randomUUID() })
          .returning();
        return createdMessage;
      } catch (error) {
        if (isUniqueConstraintError(error, "messages_idempotency_key_key")) {
          throw MessageError.idempotencyConflict(error);
        }
        throw error;
      }
    },
  };
}

export type MessageService = ReturnType<typeof initMessageService>;
