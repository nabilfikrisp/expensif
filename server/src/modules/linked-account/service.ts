import { and, eq } from "drizzle-orm";

import { LinkedAccountError } from "@/modules/linked-account/error";
import { linkedAccounts } from "@/modules/linked-account/schema";
import { users } from "@/modules/user/schema";
import type { Db } from "@/pkg/db";
import { isUniqueConstraintError } from "@/pkg/db/error";

export function initLinkedAccountService(db: Db) {
  return {
    async linkAccount(
      userId: string,
      platform: string,
      platformUserId: string,
      platformUsername?: string
    ) {
      const id = crypto.randomUUID();
      const defaultPlatformUsername = platformUsername ?? null;

      try {
        const [row] = await db
          .insert(linkedAccounts)
          .values({
            id,
            userId,
            platform,
            platformUserId,
            platformUsername: defaultPlatformUsername,
          })
          .returning();

        return row;
      } catch (err: unknown) {
        if (isUniqueConstraintError(err)) {
          throw LinkedAccountError.accountAlreadyLinked();
        }
        throw err;
      }
    },

    async getLinkedAccount(platform: string, platformUserId: string) {
      const row = await db
        .select()
        .from(linkedAccounts)
        .where(
          and(
            eq(linkedAccounts.platform, platform),
            eq(linkedAccounts.platformUserId, platformUserId)
          )
        )
        .get();

      if (!row) {
        throw LinkedAccountError.accountNotFound();
      }

      return row;
    },

    async getUserByLinkedAccount(platform: string, platformUserId: string) {
      const row = await db
        .select({
          userId: linkedAccounts.userId,
          linkedAccountId: linkedAccounts.id,
          name: users.name,
          email: users.email,
        })
        .from(linkedAccounts)
        .innerJoin(users, eq(linkedAccounts.userId, users.id))
        .where(
          and(
            eq(linkedAccounts.platform, platform),
            eq(linkedAccounts.platformUserId, platformUserId)
          )
        )
        .get();

      if (!row) {
        throw LinkedAccountError.accountNotFound();
      }

      return {
        userId: row.userId,
        linkedAccountId: row.linkedAccountId,
        userName: row.name,
        userEmail: row.email,
      };
    },

    async unlinkAccount(userId: string, accountId: string) {
      const result = await db
        .delete(linkedAccounts)
        .where(and(eq(linkedAccounts.id, accountId), eq(linkedAccounts.userId, userId)))
        .run();

      if (result.rowsAffected === 0) {
        throw LinkedAccountError.accountNotFound();
      }
    },
  };
}
