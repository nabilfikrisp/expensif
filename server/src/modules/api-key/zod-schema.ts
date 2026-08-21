import { createSelectSchema } from "drizzle-orm/zod";
import { apiKeys } from "./schema";

export const apiKeySelectSchema = createSelectSchema(apiKeys);

export const apiKeyRespSchema = apiKeySelectSchema
  .omit({ keyHash: true, userId: true })
  .openapi("ApiKey");
