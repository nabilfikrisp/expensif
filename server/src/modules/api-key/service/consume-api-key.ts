import { and, eq, isNull, sql } from "drizzle-orm";
import type { ConsumeApiKeyInput, ConsumeApiKeyOutput } from "./dto";
import { ApiKeyError } from "@/modules/api-key/error";
import { apiKeys } from "@/modules/api-key/schema";
import type { Tx } from "@/pkg/db";

interface InitConsumeApiKeyDeps {
  hashApiKey: (input: string) => string;
}

export function initConsumeApiKey({ hashApiKey }: InitConsumeApiKeyDeps) {
  /**
   * Atomically verify and consume an API key (single-use enforcement).
   *
   * Validates key hash, checks not revoked/used/expired, marks as used.
   * Throws ApiKeyError.keyInvalid() if validation fails.
   * Must be called within a transaction for rollback support, `tx` is required
   * so a caller can't accidentally burn a key outside one.
   */
  return async function consumeApiKey(
    plainKey: ConsumeApiKeyInput["plainKey"],
    tx: Tx
  ): Promise<ConsumeApiKeyOutput> {
    const keyHash = hashApiKey(plainKey);

    // Acquire the lock before checking expiry, including waits on an unchanged row.
    const key = (
      await tx
        .select({ id: apiKeys.id })
        .from(apiKeys)
        .where(eq(apiKeys.keyHash, keyHash))
        .limit(1)
        .for("update")
    ).at(0);

    if (!key) {
      throw ApiKeyError.keyInvalid();
    }

    const result = await tx
      .update(apiKeys)
      .set({ lastUsedAt: sql`clock_timestamp()` })
      .where(
        and(
          eq(apiKeys.id, key.id),
          isNull(apiKeys.revokedAt),
          isNull(apiKeys.lastUsedAt),
          sql`${apiKeys.expiresAt} > clock_timestamp()`
        )
      )
      .returning({ userId: apiKeys.userId });

    if (result.length === 0) {
      throw ApiKeyError.keyInvalid();
    }

    return { userId: result[0].userId };
  };
}
