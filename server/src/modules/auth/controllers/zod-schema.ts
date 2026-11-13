import { z } from "@hono/zod-openapi";

export const userRespSchema = z
  .object({
    id: z.uuid(),
    email: z.string(),
    name: z.string(),
  })
  .openapi("User");
