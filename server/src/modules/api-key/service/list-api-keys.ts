import { and, count, eq, ilike, isNotNull, isNull } from "drizzle-orm";
import type { ListApiKeysInput, ListApiKeysOutput, ListApiKeysFilters } from "./dto";
import { apiKeys } from "@/modules/api-key/schema";
import type { Db } from "@/pkg/db";

interface InitListApiKeysDeps {
  db: Db;
}

export function initListApiKeys({ db }: InitListApiKeysDeps) {
  /**
   * List API keys for a user with validated pagination and filters.
   *
   * @param userId - The user whose keys to list
   * @param filters.page - Page number
   * @param filters.limit - Items per page
   * @param filters.status - Filter by key status: "active" (not revoked), "revoked", or "all"
   * @param filters.label - Partial match filter on key label
   */
  return async function listApiKeys(
    userId: ListApiKeysInput["userId"],
    filters: ListApiKeysFilters
  ): Promise<ListApiKeysOutput> {
    const { page, limit, status } = filters;
    const offset = (page - 1) * limit;

    const conditions = [eq(apiKeys.userId, userId)];

    if (status === "active") {
      conditions.push(isNull(apiKeys.revokedAt));
    } else if (status === "revoked") {
      conditions.push(isNotNull(apiKeys.revokedAt));
    }
    // "all" — no additional filter

    if (filters.label) {
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
      .orderBy(apiKeys.createdAt, apiKeys.id)
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
  };
}
