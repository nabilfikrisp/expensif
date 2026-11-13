import { z } from "zod";

export const redeemApiKeyInputSchema = z.object({
  token: z.string(),
  platform: z.string(),
  platformUserId: z.string(),
  platformUsername: z.string().optional(),
  idempotencyKey: z.string(),
});
export type RedeemApiKeyInput = z.infer<typeof redeemApiKeyInputSchema>;
export const redeemApiKeyOutputSchema = z.object({ userName: z.string(), userEmail: z.string() });
export type RedeemApiKeyOutput = z.infer<typeof redeemApiKeyOutputSchema>;

export const burnApiKeyInputSchema = z.object({ token: z.string() });
export type BurnApiKeyInput = z.infer<typeof burnApiKeyInputSchema>;
export const burnApiKeyOutputSchema = z.void();
export type BurnApiKeyOutput = z.infer<typeof burnApiKeyOutputSchema>;

export type RedeemApiKey = RedeemApiKeyInput;
