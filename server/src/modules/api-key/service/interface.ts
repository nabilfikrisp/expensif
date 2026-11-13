import type {
  GenerateApiKeyInput,
  GenerateApiKeyOutput,
  ListApiKeysInput,
  ListApiKeysOutput,
  ConsumeApiKeyInput,
  ConsumeApiKeyOutput,
  BurnApiKeyInput,
  BurnApiKeyOutput,
  RevokeApiKeyInput,
  RevokeApiKeyOutput,
  DeleteApiKeyInput,
  DeleteApiKeyOutput,
} from "./dto";
import type { DbTx, Tx } from "@/pkg/db";

export interface ApiKeyService {
  generateApiKey(
    userId: GenerateApiKeyInput["userId"],
    label?: GenerateApiKeyInput["label"]
  ): Promise<GenerateApiKeyOutput>;
  listApiKeys(
    userId: ListApiKeysInput["userId"],
    filters: ListApiKeysInput["filters"]
  ): Promise<ListApiKeysOutput>;
  consumeApiKey(plainKey: ConsumeApiKeyInput["plainKey"], tx: Tx): Promise<ConsumeApiKeyOutput>;
  burnApiKey(plainKey: BurnApiKeyInput["plainKey"], tx: DbTx): Promise<BurnApiKeyOutput>;
  revokeApiKey(
    userId: RevokeApiKeyInput["userId"],
    keyId: RevokeApiKeyInput["keyId"]
  ): Promise<RevokeApiKeyOutput>;
  deleteApiKey(
    userId: DeleteApiKeyInput["userId"],
    keyId: DeleteApiKeyInput["keyId"]
  ): Promise<DeleteApiKeyOutput>;
}
