import type { LinkedAccountUseCase } from "./interface";
import { initRedeemApiKey } from "./redeem-api-key";
import type { ApiKeyService } from "@/modules/api-key/service/interface";
import type { LinkedAccountService } from "@/modules/linked-account/service/interface";
import type { UserService } from "@/modules/user/service/interface";
import type { Db } from "@/pkg/db";

interface InitLinkedAccountUseCase {
  db: Db;
  apiKeyService: ApiKeyService;
  linkedAccountService: LinkedAccountService;
  userService: UserService;
}

export function initLinkedAccountUseCase({
  db,
  apiKeyService,
  linkedAccountService,
  userService,
}: InitLinkedAccountUseCase): LinkedAccountUseCase {
  return {
    redeemApiKey: initRedeemApiKey({ db, apiKeyService, linkedAccountService, userService }),
  };
}
