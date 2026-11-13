import { eq } from "drizzle-orm";
import type { FindLinkedAccountForRetryInput, FindLinkedAccountForRetryOutput } from "./dto";
import { linkedAccounts } from "@/modules/linked-account/schema";
import type { Tx } from "@/pkg/db";

export function initFindLinkedAccountForRetry() {
  return async function findLinkedAccountForRetry(
    idempotencyKey: FindLinkedAccountForRetryInput["idempotencyKey"],
    tx: Tx
  ): Promise<FindLinkedAccountForRetryOutput> {
    // Keep a completed link from being unlinked until its retry transaction finishes.
    return (
      await tx
        .select({
          userId: linkedAccounts.userId,
          platform: linkedAccounts.platform,
          platformUserId: linkedAccounts.platformUserId,
        })
        .from(linkedAccounts)
        .where(eq(linkedAccounts.idempotencyKey, idempotencyKey))
        .limit(1)
        .for("share")
    ).at(0);
  };
}
