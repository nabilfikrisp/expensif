import type { RedeemApiKeyInput, RedeemApiKeyOutput } from "./dto";
import { ApiKeyError } from "@/modules/api-key/error";
import type { ApiKeyService } from "@/modules/api-key/service/interface";
import { LinkedAccountError } from "@/modules/linked-account/error";
import type { LinkedAccountService } from "@/modules/linked-account/service/interface";
import type { UserService } from "@/modules/user/service/interface";
import type { Db, Tx } from "@/pkg/db";

interface InitRedeemApiKeyDeps {
  db: Db;
  apiKeyService: ApiKeyService;
  linkedAccountService: LinkedAccountService;
  userService: UserService;
}

export function initRedeemApiKey({
  db,
  apiKeyService,
  linkedAccountService,
  userService,
}: InitRedeemApiKeyDeps) {
  async function findCompletedRedemption(
    { idempotencyKey, platform, platformUserId }: RedeemApiKeyInput,
    tx: Tx
  ) {
    const account = await linkedAccountService.findLinkedAccountForRetry(idempotencyKey, tx);
    if (!account) {
      return undefined;
    }
    if (account.platform !== platform || account.platformUserId !== platformUserId) {
      throw LinkedAccountError.keyInvalid();
    }
    const user = await userService.getUser(account.userId, tx);
    return { userName: user.name, userEmail: user.email };
  }

  return async function redeemApiKey(params: RedeemApiKeyInput): Promise<RedeemApiKeyOutput> {
    const { token, platform, platformUserId, platformUsername, idempotencyKey } = params;
    try {
      return await db.transaction(async (tx) => {
        const completed = await findCompletedRedemption(params, tx);
        if (completed) {
          return completed;
        }

        const { userId } = await apiKeyService.consumeApiKey(token, tx);

        await linkedAccountService.linkAccount({
          tx,
          userId,
          platform,
          platformUserId,
          platformUsername,
          idempotencyKey,
        });

        const user = await userService.getUser(userId, tx);

        return { userName: user.name, userEmail: user.email };
      });
    } catch (error) {
      const invalidKey = error instanceof ApiKeyError;
      const conflictingLink =
        error instanceof LinkedAccountError && error.code === "ACCOUNT_ALREADY_LINKED";
      if (!invalidKey && !conflictingLink) {
        throw error;
      }

      // Recheck after rollback: another delivery may have completed while we
      // waited, and any key consumed before a conflicting insert must be restored.
      const completed = await db.transaction((tx) => findCompletedRedemption(params, tx));
      if (completed) {
        return completed;
      }
      if (invalidKey) {
        throw LinkedAccountError.keyInvalid();
      }
      throw error;
    }
  };
}
