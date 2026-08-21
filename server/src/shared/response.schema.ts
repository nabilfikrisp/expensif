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

export const paginationSchema = z
  .object({
    page: z.number().int().openapi({ example: 1 }),
    limit: z.number().int().openapi({ example: 10 }),
    total: z.number().int().openapi({ example: 42 }),
    totalPages: z.number().int().openapi({ example: 5 }),
  })
  .openapi("Pagination");

export const paginatedRespSchema = <T extends z.ZodType>(dataSchema: T) =>
  successRespSchema
    .extend({
      data: z.array(dataSchema),
      pagination: paginationSchema,
    })
    .openapi("PaginatedResponse");
