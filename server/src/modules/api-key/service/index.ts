import { createHmac } from "node:crypto";
import { initConsumeApiKey } from "./consume-api-key";
import { initDeleteApiKey } from "./delete-api-key";
import { initGenerateApiKey } from "./generate-api-key";
import type { ApiKeyService } from "./interface";
import { initListApiKeys } from "./list-api-keys";
import { initRevokeApiKey } from "./revoke-api-key";
import type { Db } from "@/pkg/db";
import type { EnvSchema } from "@/pkg/env";

interface InitApiKeyServiceDeps {
  env: EnvSchema;
  db: Db;
}

export function initApiKeyService({ env, db }: InitApiKeyServiceDeps): ApiKeyService {
  const hashApiKey = (input: string): string =>
    createHmac("sha256", env.API_KEY_SECRET).update(input).digest("hex");

  return {
    generateApiKey: initGenerateApiKey({ env, db, hashApiKey }),
    listApiKeys: initListApiKeys({ db }),
    consumeApiKey: initConsumeApiKey({ hashApiKey }),
    revokeApiKey: initRevokeApiKey({ db }),
    deleteApiKey: initDeleteApiKey({ db }),
  };
}
