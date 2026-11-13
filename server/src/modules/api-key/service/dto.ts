import { z } from "zod";

export const generateApiKeyInputSchema = z.object({
  userId: z.string(),
  label: z.string().optional(),
});
export type GenerateApiKeyInput = z.infer<typeof generateApiKeyInputSchema>;

export const generateApiKeyOutputSchema = z.object({
  id: z.string(),
  key: z.string(),
  label: z.string().nullable(),
  createdAt: z.string(),
  expiresAt: z.string(),
  keyHint: z.string(),
});
export type GenerateApiKeyOutput = z.infer<typeof generateApiKeyOutputSchema>;

export const listApiKeysInputSchema = z.object({
  userId: z.string(),
  filters: z.object({
    label: z.string().optional(),
    status: z.enum(["active", "revoked", "all"]),
    page: z.number(),
    limit: z.number(),
  }),
});
export type ListApiKeysInput = z.infer<typeof listApiKeysInputSchema>;
export type ListApiKeysFilters = ListApiKeysInput["filters"];

export const listApiKeysOutputSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      label: z.string().nullable(),
      keyHint: z.string(),
      createdAt: z.string(),
      expiresAt: z.string(),
      lastUsedAt: z.string().nullable(),
      revokedAt: z.string().nullable(),
    })
  ),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }),
});
export type ListApiKeysOutput = z.infer<typeof listApiKeysOutputSchema>;

export const consumeApiKeyInputSchema = z.object({ plainKey: z.string() });
export type ConsumeApiKeyInput = z.infer<typeof consumeApiKeyInputSchema>;
export const consumeApiKeyOutputSchema = z.object({ userId: z.string() });
export type ConsumeApiKeyOutput = z.infer<typeof consumeApiKeyOutputSchema>;

export const revokeApiKeyInputSchema = z.object({ userId: z.string(), keyId: z.string() });
export type RevokeApiKeyInput = z.infer<typeof revokeApiKeyInputSchema>;
export const revokeApiKeyOutputSchema = z.void();
export type RevokeApiKeyOutput = z.infer<typeof revokeApiKeyOutputSchema>;

export const deleteApiKeyInputSchema = z.object({ userId: z.string(), keyId: z.string() });
export type DeleteApiKeyInput = z.infer<typeof deleteApiKeyInputSchema>;
export const deleteApiKeyOutputSchema = z.void();
export type DeleteApiKeyOutput = z.infer<typeof deleteApiKeyOutputSchema>;
