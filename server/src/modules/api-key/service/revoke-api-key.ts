import { and, eq, isNull, sql } from "drizzle-orm";
import type { RevokeApiKeyInput, RevokeApiKeyOutput } from "./dto";
import { ApiKeyError } from "@/modules/api-key/error";
import { apiKeys } from "@/modules/api-key/schema";
import type { Db } from "@/pkg/db";

interface InitRevokeApiKeyDeps {
  db: Db;
}

export function initRevokeApiKey({ db }: InitRevokeApiKeyDeps) {
  return async function revokeApiKey(
    userId: RevokeApiKeyInput["userId"],
    keyId: RevokeApiKeyInput["keyId"]
  ): Promise<RevokeApiKeyOutput> {
    const result = await db
      .update(apiKeys)
      .set({ revokedAt: sql`clock_timestamp()` })
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)))
      .returning({ id: apiKeys.id });

    if (result.length === 0) {
      const existing = (
        await db
          .select({ id: apiKeys.id, revokedAt: apiKeys.revokedAt })
          .from(apiKeys)
          .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
          .limit(1)
      ).at(0);

      if (!existing) {
        throw ApiKeyError.keyNotFound();
      }
      if (existing.revokedAt !== null) {
        throw ApiKeyError.keyAlreadyRevoked();
      }
      throw ApiKeyError.keyNotFound();
    }
  };
}
