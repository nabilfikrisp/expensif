import { createSelectSchema } from "drizzle-orm/zod";
import { users } from "./schema";

export const userSelectSchema = createSelectSchema(users);

export const userRespSchema = userSelectSchema
  .omit({ passwordHash: true, createdAt: true })
  .openapi("User");
