import type { RedeemApiKeyInput, RedeemApiKeyOutput } from "./dto";

export interface LinkedAccountUseCase {
  redeemApiKey(params: RedeemApiKeyInput): Promise<RedeemApiKeyOutput>;
}
