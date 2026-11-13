import { z } from "@hono/zod-openapi";

export const linkedAccountRespSchema = z
  .object({
    id: z.string(),
    platform: z.string(),
    platformUserId: z.string(),
    platformUsername: z.string().nullable(),
    linkedAt: z.string(),
  })
  .openapi("LinkedAccount");
