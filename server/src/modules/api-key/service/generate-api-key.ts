import { sql } from "drizzle-orm";
import type { GenerateApiKeyInput, GenerateApiKeyOutput } from "./dto";
import { apiKeys } from "@/modules/api-key/schema";
import type { Db } from "@/pkg/db";
import type { EnvSchema } from "@/pkg/env";

interface InitGenerateApiKeyDeps {
  hashApiKey: (input: string) => string;
  db: Db;
  env: Pick<EnvSchema, "API_KEY_REDEEM_WINDOW_MINUTES">;
}

export function initGenerateApiKey({ env, db, hashApiKey }: InitGenerateApiKeyDeps) {
  return async function generateApiKey(
    userId: GenerateApiKeyInput["userId"],
    label?: GenerateApiKeyInput["label"]
  ): Promise<GenerateApiKeyOutput> {
    const KEY_PREFIX = "ek_";

    const defaultLabel = label ?? null;

    const id = crypto.randomUUID();
    const rawKey = crypto.randomUUID().replace(/-/g, "");
    const key = `${KEY_PREFIX}${rawKey}`;
    const keyHint = `${KEY_PREFIX}****${rawKey.slice(-4)}`;
    const keyHash = hashApiKey(key);

    const [inserted] = await db
      .insert(apiKeys)
      .values({
        id,
        userId,
        keyHash,
        label: defaultLabel,
        keyHint,
        expiresAt: sql`CURRENT_TIMESTAMP + make_interval(mins => ${env.API_KEY_REDEEM_WINDOW_MINUTES}::integer)`,
      })
      .returning();

    return {
      id,
      key,
      label: defaultLabel,
      createdAt: inserted.createdAt,
      expiresAt: inserted.expiresAt,
      keyHint,
    };
  };
}
