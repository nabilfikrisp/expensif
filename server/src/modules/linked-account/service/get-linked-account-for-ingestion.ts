import { and, eq } from "drizzle-orm";
import type { GetLinkedAccountForIngestionInput, GetLinkedAccountForIngestionOutput } from "./dto";
import { LinkedAccountError } from "@/modules/linked-account/error";
import { linkedAccounts } from "@/modules/linked-account/schema";
import type { Tx } from "@/pkg/db";

export function initGetLinkedAccountForIngestion() {
  return async function getLinkedAccountForIngestion(
    platform: GetLinkedAccountForIngestionInput["platform"],
    platformUserId: GetLinkedAccountForIngestionInput["platformUserId"],
    tx: Tx
  ): Promise<GetLinkedAccountForIngestionOutput> {
    // Keep this owner linked until the ingestion or completed-result transaction finishes.
    const account = (
      await tx
        .select()
        .from(linkedAccounts)
        .where(
          and(
            eq(linkedAccounts.platform, platform),
            eq(linkedAccounts.platformUserId, platformUserId)
          )
        )
        .limit(1)
        .for("share")
    ).at(0);

    if (!account) {
      throw LinkedAccountError.accountNotFound();
    }

    return account;
  };
}
