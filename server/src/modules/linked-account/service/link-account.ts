import type { LinkAccountInput, LinkAccountOutput } from "./dto";
import { LinkedAccountError } from "@/modules/linked-account/error";
import { linkedAccounts } from "@/modules/linked-account/schema";
import type { Db, DbTx } from "@/pkg/db";
import { isUniqueConstraintError } from "@/pkg/db/error";

interface InitLinkAccountDeps {
  db: Db;
}

export function initLinkAccount({ db }: InitLinkAccountDeps) {
  return async function linkAccount({
    tx = db,
    ...params
  }: LinkAccountInput & { tx?: DbTx }): Promise<LinkAccountOutput> {
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
          idempotencyKey: params.idempotencyKey ?? null,
        })
        .returning();

      return row;
    } catch (err: unknown) {
      if (isUniqueConstraintError(err)) {
        throw LinkedAccountError.accountAlreadyLinked();
      }
      throw err;
    }
  };
}
