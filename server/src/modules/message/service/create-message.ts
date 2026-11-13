import { MessageError } from "../error";
import { messages } from "../schema";
import { createMessageInputSchema } from "./dto";
import type { CreateMessageInput, CreateMessageOutput } from "./dto";
import type { Tx } from "@/pkg/db";
import { isUniqueConstraintError } from "@/pkg/db/error";

export function initCreateMessage() {
  return async function createMessage(
    input: CreateMessageInput,
    tx: Tx
  ): Promise<CreateMessageOutput> {
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
  };
}
