import type {
  BurnApiKeyInput,
  BurnApiKeyOutput,
  RedeemApiKeyInput,
  RedeemApiKeyOutput,
} from "./dto";

export interface LinkedAccountUseCase {
  redeemApiKey(params: RedeemApiKeyInput): Promise<RedeemApiKeyOutput>;
  burnApiKey(token: BurnApiKeyInput["token"]): Promise<BurnApiKeyOutput>;
}
