import { eq } from "drizzle-orm";
import { messages } from "../schema";
import type { FindMessageByIdempotencyKeyInput, FindMessageByIdempotencyKeyOutput } from "./dto";
import type { Db, DbTx } from "@/pkg/db";

interface InitFindMessageByIdempotencyKeyDeps {
  db: Db;
}

export function initFindMessageByIdempotencyKey({ db }: InitFindMessageByIdempotencyKeyDeps) {
  return async function findMessageByIdempotencyKey(
    idempotencyKey: FindMessageByIdempotencyKeyInput["idempotencyKey"],
    database: DbTx = db
  ): Promise<FindMessageByIdempotencyKeyOutput> {
    // The ingestion use case must verify the returned owner before exposing a retry result.
    const matchingMessages = await database
      .select()
      .from(messages)
      .where(eq(messages.idempotencyKey, idempotencyKey))
      .limit(1);

    return matchingMessages.at(0);
  };
}
