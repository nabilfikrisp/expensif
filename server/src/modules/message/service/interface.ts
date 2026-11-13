import type {
  CreateMessageInput,
  CreateMessageOutput,
  FindMessageByIdempotencyKeyInput,
  FindMessageByIdempotencyKeyOutput,
} from "./dto";
import type { DbTx, Tx } from "@/pkg/db";

export interface MessageService {
  findMessageByIdempotencyKey(
    idempotencyKey: FindMessageByIdempotencyKeyInput["idempotencyKey"],
    database?: DbTx
  ): Promise<FindMessageByIdempotencyKeyOutput>;
  createMessage(input: CreateMessageInput, tx: Tx): Promise<CreateMessageOutput>;
}
