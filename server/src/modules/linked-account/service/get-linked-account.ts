import { and, eq } from "drizzle-orm";
import type { GetLinkedAccountInput, GetLinkedAccountOutput } from "./dto";
import { LinkedAccountError } from "@/modules/linked-account/error";
import { linkedAccounts } from "@/modules/linked-account/schema";
import type { Db } from "@/pkg/db";

interface InitGetLinkedAccountDeps {
  db: Db;
}

export function initGetLinkedAccount({ db }: InitGetLinkedAccountDeps) {
  return async function getLinkedAccount(
    platform: GetLinkedAccountInput["platform"],
    platformUserId: GetLinkedAccountInput["platformUserId"]
  ): Promise<GetLinkedAccountOutput> {
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
  };
}
