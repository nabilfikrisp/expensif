import { and, eq } from "drizzle-orm";

import { LinkedAccountError } from "@/modules/linked-account/error";
import { linkedAccounts } from "@/modules/linked-account/schema";
import { users } from "@/modules/user/schema";
import type { Db, DbTx } from "@/pkg/db";
import { isUniqueConstraintError } from "@/pkg/db/error";

export interface LinkAccount {
  userId: string;
  platform: string;
  platformUserId: string;
  platformUsername?: string;
  tx?: DbTx;
}

export function initLinkedAccountService(db: Db) {
  return {
    async linkAccount({ tx = db, ...params }: LinkAccount) {
      const id = crypto.randomUUID();

      try {
        const [row] = await tx
          .insert(linkedAccounts)
          .values({
            id,
            userId: params.userId,
            platform: params.platform,
            platformUserId: params.platformUserId,
            platformUsername: params.platformUsername ?? null,
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
      const row = (
        await db
          .select()
          .from(linkedAccounts)
          .where(
            and(
              eq(linkedAccounts.platform, platform),
              eq(linkedAccounts.platformUserId, platformUserId)
            )
          )
          .limit(1)
      ).at(0);

      if (!row) {
        throw LinkedAccountError.accountNotFound();
      }

      return row;
    },

    async getUserByLinkedAccount(platform: string, platformUserId: string) {
      const row = (
        await db
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
          .limit(1)
      ).at(0);

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

    async listLinkedAccounts(userId: string) {
      return await db
        .select({
          id: linkedAccounts.id,
          platform: linkedAccounts.platform,
          platformUserId: linkedAccounts.platformUserId,
          platformUsername: linkedAccounts.platformUsername,
          linkedAt: linkedAccounts.linkedAt,
        })
        .from(linkedAccounts)
        .where(eq(linkedAccounts.userId, userId));
    },

    async unlinkAccount(userId: string, accountId: string) {
      const result = await db
        .delete(linkedAccounts)
        .where(and(eq(linkedAccounts.id, accountId), eq(linkedAccounts.userId, userId)))
        .returning({ id: linkedAccounts.id });

      if (result.length === 0) {
        throw LinkedAccountError.accountNotFound();
      }
    },
  };
}

export type LinkedAccountService = ReturnType<typeof initLinkedAccountService>;
