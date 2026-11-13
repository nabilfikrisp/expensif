import { and, eq } from "drizzle-orm";
import type { UnlinkAccountInput, UnlinkAccountOutput } from "./dto";
import { LinkedAccountError } from "@/modules/linked-account/error";
import { linkedAccounts } from "@/modules/linked-account/schema";
import type { Db } from "@/pkg/db";

interface InitUnlinkAccountDeps {
  db: Db;
}

export function initUnlinkAccount({ db }: InitUnlinkAccountDeps) {
  return async function unlinkAccount(
    userId: UnlinkAccountInput["userId"],
    accountId: UnlinkAccountInput["accountId"]
  ): Promise<UnlinkAccountOutput> {
    const result = await db
      .delete(linkedAccounts)
      .where(and(eq(linkedAccounts.id, accountId), eq(linkedAccounts.userId, userId)))
      .returning({ id: linkedAccounts.id });

    if (result.length === 0) {
      throw LinkedAccountError.accountNotFound();
    }
  };
}
