import { z } from "@hono/zod-openapi";
import { and, count, eq, ilike, isNotNull, isNull, sql } from "drizzle-orm";
import { createHmac } from "node:crypto";

import { ApiKeyError } from "@/modules/api-key/error";
import { apiKeys } from "@/modules/api-key/schema";
import type { Db, DbTx, Tx } from "@/pkg/db";
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
        conditions.push(ilike(apiKeys.label, `%${filters.label}%`));
      }

      const where = and(...conditions);

      const result = await db
        .select({
          id: apiKeys.id,
          label: apiKeys.label,
          keyHint: apiKeys.keyHint,
          createdAt: apiKeys.createdAt,
          expiresAt: apiKeys.expiresAt,
          lastUsedAt: apiKeys.lastUsedAt,
          revokedAt: apiKeys.revokedAt,
        })
        .from(apiKeys)
        .where(where)
        .limit(limit)
        .offset(offset);

      const [{ count: total }] = await db.select({ count: count() }).from(apiKeys).where(where);

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
    /**
     * Atomically verify and consume an API key (single-use enforcement).
     *
     * Validates key hash, checks not revoked/used/expired, marks as used.
     * Throws ApiKeyError.keyInvalid() if validation fails.
     * Must be called within a transaction for rollback support, `tx` is required
     * so a caller can't accidentally burn a key outside one.
     */
    async consumeApiKey(plainKey: string, tx: Tx) {
      const keyHash = hashApiKey(env, plainKey);

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
    },
    async burnApiKey(plainKey: string, tx: DbTx) {
      const keyHash = hashApiKey(env, plainKey);
      await tx
        .update(apiKeys)
        .set({ lastUsedAt: sql`clock_timestamp()` })
        .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.lastUsedAt)));
    },
    async revokeApiKey(userId: string, keyId: string) {
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
    },

    async deleteApiKey(userId: string, keyId: string) {
      const result = await db
        .delete(apiKeys)
        .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
        .returning({ id: apiKeys.id });

      if (result.length === 0) {
        throw ApiKeyError.keyNotFound();
      }
    },
  };
}

function hashApiKey(env: EnvSchema, input: string): string {
  return createHmac("sha256", env.API_KEY_SECRET).update(input).digest("hex");
}

export type ApiKeyService = ReturnType<typeof initApiKeyService>;
