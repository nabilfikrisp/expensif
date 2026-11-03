import { eq } from "drizzle-orm";

import { UserError } from "@/modules/user/error";
import { users } from "@/modules/user/schema";
import type { Db, DbTx } from "@/pkg/db";

export function initUserService(db: Db) {
  return {
    async getUser(userId: string, tx: DbTx = db) {
      const user = await tx
        .select({ name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, userId))
        .get();

      if (!user) {
        throw UserError.notFound();
      }

      return user;
    },
  };
}
export type UserService = ReturnType<typeof initUserService>;
