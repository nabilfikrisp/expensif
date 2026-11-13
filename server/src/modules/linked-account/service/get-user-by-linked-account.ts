import { and, eq } from "drizzle-orm";
import type { GetUserByLinkedAccountInput, GetUserByLinkedAccountOutput } from "./dto";
import { LinkedAccountError } from "@/modules/linked-account/error";
import { linkedAccounts } from "@/modules/linked-account/schema";
import { users } from "@/modules/user/schema";
import type { Db } from "@/pkg/db";

interface InitGetUserByLinkedAccountDeps {
  db: Db;
}

export function initGetUserByLinkedAccount({ db }: InitGetUserByLinkedAccountDeps) {
  return async function getUserByLinkedAccount(
    platform: GetUserByLinkedAccountInput["platform"],
    platformUserId: GetUserByLinkedAccountInput["platformUserId"]
  ): Promise<GetUserByLinkedAccountOutput> {
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
  };
}
