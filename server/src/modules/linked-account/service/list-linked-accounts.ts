import { eq } from "drizzle-orm";
import type { ListLinkedAccountsInput, ListLinkedAccountsOutput } from "./dto";
import { linkedAccounts } from "@/modules/linked-account/schema";
import type { Db } from "@/pkg/db";

interface InitListLinkedAccountsDeps {
  db: Db;
}

export function initListLinkedAccounts({ db }: InitListLinkedAccountsDeps) {
  return async function listLinkedAccounts(
    userId: ListLinkedAccountsInput["userId"]
  ): Promise<ListLinkedAccountsOutput> {
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
  };
}
