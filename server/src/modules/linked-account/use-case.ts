import { ApiKeyError } from "@/modules/api-key/error";
import type { ApiKeyService } from "@/modules/api-key/service";
import { LinkedAccountError } from "@/modules/linked-account/error";
import type { LinkedAccountService } from "@/modules/linked-account/service";
import type { UserService } from "@/modules/user/service";
import type { Db } from "@/pkg/db";

export interface InitLinkedAccountUseCase {
  db: Db;
  apiKeyService: ApiKeyService;
  linkedAccountService: LinkedAccountService;
  userService: UserService;
}

export interface RedeemApiKey {
  token: string;
  platform: string;
  platformUserId: string;
  platformUsername?: string;
}

export function initLinkedAccountUseCase({
  db,
  apiKeyService,
  linkedAccountService,
  userService,
}: InitLinkedAccountUseCase) {
  return {
    async redeemApiKey({ token, platform, platformUserId, platformUsername }: RedeemApiKey) {
      return await db.transaction(async (tx) => {
        let userId: string;
        try {
          ({ userId } = await apiKeyService.consumeApiKey(token, tx));
        } catch (err) {
          if (err instanceof ApiKeyError) {
            throw LinkedAccountError.keyInvalid();
          }
          throw err;
        }

        await linkedAccountService.linkAccount({
          tx,
          userId,
          platform,
          platformUserId,
          platformUsername,
        });

        const user = await userService.getUser(userId, tx);

        return { userName: user.name, userEmail: user.email };
      });
    },
    async burnApiKey(token: string) {
      await apiKeyService.burnApiKey(token, db);
    },
  };
}

export type LinkedAccountUseCase = ReturnType<typeof initLinkedAccountUseCase>;
