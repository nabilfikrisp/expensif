import { eq } from "drizzle-orm";

import { UserError } from "@/modules/user/error";
import { users } from "@/modules/user/schema";
import type { Db, DbTx } from "@/pkg/db";

export function initUserService(db: Db) {
  return {
    async deleteUser(userId: string, tx: DbTx = db) {
      const deleted = await tx
        .delete(users)
        .where(eq(users.id, userId))
        .returning({ id: users.id });

      if (deleted.length === 0) {
        throw UserError.notFound();
      }
    },
    async getUser(userId: string, tx: DbTx = db) {
      const user = (
        await tx
          .select({ id: users.id, name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1)
      ).at(0);

      if (!user) {
        throw UserError.notFound();
      }

      return user;
    },
    async getUserByEmail(email: string, tx: DbTx = db) {
      const user = (
        await tx
          .select({ id: users.id, name: users.name, email: users.email })
          .from(users)
          .where(eq(users.email, email))
          .limit(1)
      ).at(0);

      if (!user) {
        throw UserError.notFound();
      }

      return user;
    },
  };
}
export type UserService = ReturnType<typeof initUserService>;
