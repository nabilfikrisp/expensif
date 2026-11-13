import { and, eq, isNull, sql } from "drizzle-orm";
import type { BurnApiKeyInput, BurnApiKeyOutput } from "./dto";
import { apiKeys } from "@/modules/api-key/schema";
import type { DbTx } from "@/pkg/db";

interface InitBurnApiKeyDeps {
  hashApiKey: (input: string) => string;
}

export function initBurnApiKey({ hashApiKey }: InitBurnApiKeyDeps) {
  return async function burnApiKey(
    plainKey: BurnApiKeyInput["plainKey"],
    tx: DbTx
  ): Promise<BurnApiKeyOutput> {
    const keyHash = hashApiKey(plainKey);
    // Do not reveal whether an exposed key exists or was already revoked.
    await tx
      .update(apiKeys)
      .set({ revokedAt: sql`clock_timestamp()` })
      .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)));
  };
}
