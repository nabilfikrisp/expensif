import { and, eq } from "drizzle-orm";
import type { DeleteApiKeyInput, DeleteApiKeyOutput } from "./dto";
import { ApiKeyError } from "@/modules/api-key/error";
import { apiKeys } from "@/modules/api-key/schema";
import type { Db } from "@/pkg/db";

interface InitDeleteApiKeyDeps {
  db: Db;
}

export function initDeleteApiKey({ db }: InitDeleteApiKeyDeps) {
  return async function deleteApiKey(
    userId: DeleteApiKeyInput["userId"],
    keyId: DeleteApiKeyInput["keyId"]
  ): Promise<DeleteApiKeyOutput> {
    const result = await db
      .delete(apiKeys)
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
      .returning({ id: apiKeys.id });

    if (result.length === 0) {
      throw ApiKeyError.keyNotFound();
    }
  };
}
