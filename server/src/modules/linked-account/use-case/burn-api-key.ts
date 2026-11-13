import type { BurnApiKeyInput, BurnApiKeyOutput } from "./dto";
import type { ApiKeyService } from "@/modules/api-key/service/interface";
import type { Db } from "@/pkg/db";

interface InitBurnApiKeyDeps {
  db: Db;
  apiKeyService: ApiKeyService;
}

export function initBurnApiKey({ db, apiKeyService }: InitBurnApiKeyDeps) {
  return async function burnApiKey(token: BurnApiKeyInput["token"]): Promise<BurnApiKeyOutput> {
    await apiKeyService.burnApiKey(token, db);
  };
}
