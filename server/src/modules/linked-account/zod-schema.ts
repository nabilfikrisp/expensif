import { createSelectSchema } from "drizzle-orm/zod";
import { linkedAccounts } from "./schema";

export const linkedAccountSelectSchema = createSelectSchema(linkedAccounts);

export const linkedAccountRespSchema = linkedAccountSelectSchema
  .omit({ userId: true, idempotencyKey: true })
  .openapi("LinkedAccount");
