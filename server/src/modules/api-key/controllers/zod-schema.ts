import { z } from "@hono/zod-openapi";

export const apiKeyRespSchema = z
  .object({
    id: z.string(),
    keyHint: z.string(),
    label: z.string().nullable(),
    createdAt: z.string(),
    expiresAt: z.string(),
    lastUsedAt: z.string().nullable(),
    revokedAt: z.string().nullable(),
  })
  .openapi("ApiKey");
