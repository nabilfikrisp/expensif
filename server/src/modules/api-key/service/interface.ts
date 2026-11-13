import type {
  GenerateApiKeyInput,
  GenerateApiKeyOutput,
  ListApiKeysInput,
  ListApiKeysOutput,
  ConsumeApiKeyInput,
  ConsumeApiKeyOutput,
  RevokeApiKeyInput,
  RevokeApiKeyOutput,
  DeleteApiKeyInput,
  DeleteApiKeyOutput,
} from "./dto";
import type { Tx } from "@/pkg/db";

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
  revokeApiKey(
    userId: RevokeApiKeyInput["userId"],
    keyId: RevokeApiKeyInput["keyId"]
  ): Promise<RevokeApiKeyOutput>;
  deleteApiKey(
    userId: DeleteApiKeyInput["userId"],
    keyId: DeleteApiKeyInput["keyId"]
  ): Promise<DeleteApiKeyOutput>;
}
