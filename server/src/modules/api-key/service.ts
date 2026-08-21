import { and, count, eq, isNotNull, isNull, like, sql } from "drizzle-orm";
import { z } from "zod";
import { createHmac } from "node:crypto";

import { ApiKeyError } from "@/modules/api-key/error";
import { apiKeys } from "@/modules/api-key/schema";
import type { Db } from "@/pkg/db";
import type { EnvSchema } from "@/pkg/env";

export const listApiKeysQuerySchema = z
  .object({
    label: z.string().optional().openapi({ example: "telegram" }),
    status: z
      .enum(["active", "revoked", "all"])
      .optional()
      .default("active")
      .openapi({ example: "active" }),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10),
  })
  .openapi("ListApiKeysQuery");
export type ListApiKeysFilters = z.infer<typeof listApiKeysQuerySchema>;

export function initApiKeyService(env: EnvSchema, db: Db) {
  return {
    async generateApiKey(userId: string, label?: string) {
      const KEY_PREFIX = "ek_";

      const defaultLabel = label ?? null;

      const id = crypto.randomUUID();
      const rawKey = crypto.randomUUID().replace(/-/g, "");
      const key = `${KEY_PREFIX}${rawKey}`;
      const keyHint = `${KEY_PREFIX}****${rawKey.slice(-4)}`;
      const keyHash = hashApiKey(env, key);

      const [instered] = await db
        .insert(apiKeys)
        .values({ id, userId, keyHash, label: defaultLabel, keyHint })
        .returning();

      return { id, key, label: defaultLabel, createdAt: instered.createdAt, keyHint };
    },
    /**
     * List API keys for a user with pagination and optional filtering.
     *
     * @param userId - The user whose keys to list
     * @param filters.page - Page number, defaults to 1
     * @param filters.limit - Items per page, defaults to 10
     * @param filters.status - Filter by key status: "active" (not revoked), "revoked", or "all". Defaults to "active"
     * @param filters.label - Partial match filter on key label
     */
    async listApiKeys(userId: string, filters?: ListApiKeysFilters) {
      const page = filters?.page ?? 1;
      const limit = filters?.limit ?? 10;
      const offset = (page - 1) * limit;
      const status = filters?.status ?? "active";

      const conditions = [eq(apiKeys.userId, userId)];

      if (status === "active") {
        conditions.push(isNull(apiKeys.revokedAt));
      } else if (status === "revoked") {
        conditions.push(isNotNull(apiKeys.revokedAt));
      }
      // "all" — no additional filter

      if (filters?.label) {
        conditions.push(like(apiKeys.label, `%${filters.label}%`));
      }

      const where = and(...conditions);

      const result = await db
        .select({
          id: apiKeys.id,
          label: apiKeys.label,
          keyHint: apiKeys.keyHint,
          createdAt: apiKeys.createdAt,
          lastUsedAt: apiKeys.lastUsedAt,
          revokedAt: apiKeys.revokedAt,
        })
        .from(apiKeys)
        .where(where)
        .limit(limit)
        .offset(offset)
        .all();

      const [{ count: total }] = await db
        .select({ count: count() })
        .from(apiKeys)
        .where(where)
        .all();

      const totalPages = Math.ceil(total / limit);

      return {
        data: result,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      };
    },
    async verifyApiKey(plainKey: string) {
      const keyHash = hashApiKey(env, plainKey);

      const [updated] = await db
        .update(apiKeys)
        .set({ lastUsedAt: sql`(CURRENT_TIMESTAMP)` })
        .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
        .returning();

      return updated;
    },
    async revokeApiKey(userId: string, keyId: string) {
      const result = await db
        .update(apiKeys)
        .set({ revokedAt: sql`(CURRENT_TIMESTAMP)` })
        .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
        .run();

      if (result.rowsAffected === 0) {
        throw ApiKeyError.keyNotFound();
      }
    },

    async deleteApiKey(userId: string, keyId: string) {
      const result = await db
        .delete(apiKeys)
        .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
        .run();

      if (result.rowsAffected === 0) {
        throw ApiKeyError.keyNotFound();
      }
    },
  };
}

function hashApiKey(env: EnvSchema, input: string): string {
  return createHmac("sha256", env.API_KEY_SECRET).update(input).digest("hex");
}

export type ApiKeyService = ReturnType<typeof initApiKeyService>;
