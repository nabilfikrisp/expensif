import { z } from "@hono/zod-openapi";

export const errorRespSchema = z
  .object({
    success: z.boolean().openapi({ example: false }),
    message: z.string(),
    error: z.string(),
  })
  .openapi("ErrorResponse");

export const successRespSchema = z
  .object({
    success: z.boolean().openapi({ example: true }),
    message: z.string().openapi({ example: "success" }),
  })
  .openapi("SuccessResponse");

export const tokenRespSchema = successRespSchema
  .extend({
    data: z.object({ accessToken: z.string() }),
  })
  .openapi("TokenResponse");
